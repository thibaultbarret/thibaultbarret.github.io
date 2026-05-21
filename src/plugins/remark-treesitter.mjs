import { Parser, Language, Query } from 'web-tree-sitter';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { visit } from 'unist-util-visit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMARS_DIR = join(__dirname, '../grammars');

const require = createRequire(import.meta.url);
const webTreeSitterWasm = join(
  dirname(require.resolve('web-tree-sitter')),
  'web-tree-sitter.wasm'
);

let parsers = null;

async function getParsers() {
  if (parsers) return parsers;

  await Parser.init({ locateFile: () => webTreeSitterWasm });

  const mfrontLang = await Language.load(join(GRAMMARS_DIR, 'mfront.wasm'));
  const mtestLang  = await Language.load(join(GRAMMARS_DIR, 'mtest.wasm'));
  const cppLang    = await Language.load(join(GRAMMARS_DIR, 'cpp.wasm'));

  const mfrontParser = new Parser(); mfrontParser.setLanguage(mfrontLang);
  const mtestParser  = new Parser(); mtestParser.setLanguage(mtestLang);
  const cppParser    = new Parser(); cppParser.setLanguage(cppLang);

  parsers = {
    mfront: {
      parser:          mfrontParser,
      query:           new Query(mfrontLang, readFileSync(join(GRAMMARS_DIR, 'mfront-highlights.scm'), 'utf8')),
      injectionQuery:  new Query(mfrontLang, readFileSync(join(GRAMMARS_DIR, 'mfront-injections.scm'), 'utf8')),
    },
    mtest: {
      parser: mtestParser,
      query:  new Query(mtestLang, readFileSync(join(GRAMMARS_DIR, 'mtest-highlights.scm'), 'utf8')),
      injectionQuery: null,
    },
    cpp: {
      parser: cppParser,
      query:  new Query(cppLang, readFileSync(join(GRAMMARS_DIR, 'cpp-highlights.scm'), 'utf8')),
    },
  };

  return parsers;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function captureToClass(name) {
  return 'ts-' + name.replace(/\./g, '-');
}

/**
 * Build a flat, sorted, non-overlapping list of highlights from a query+tree.
 * Returns [{start, end, cls}] sorted by start, offset by `baseOffset`.
 */
function getHighlights(code, query, parser, baseOffset = 0) {
  const tree = parser.parse(code);
  const captures = query.captures(tree.rootNode);

  captures.sort((a, b) => {
    if (a.node.startIndex !== b.node.startIndex)
      return a.node.startIndex - b.node.startIndex;
    return b.node.endIndex - a.node.endIndex;
  });

  const result = [];
  let pos = 0;
  for (const { name, node } of captures) {
    const s = node.startIndex, e = node.endIndex;
    if (e <= pos || s < pos) continue;
    result.push({ start: baseOffset + s, end: baseOffset + e, cls: captureToClass(name) });
    pos = e;
  }
  return result;
}

/**
 * Merge two highlight lists. `overlay` wins over `base` where they overlap:
 * base spans that intersect an overlay range are clipped or dropped.
 */
function mergeHighlights(base, overlay) {
  if (!overlay.length) return base;

  const result = [];

  for (const b of base) {
    // Check if any overlay span overlaps with b
    const overlapping = overlay.filter(o => o.end > b.start && o.start < b.end);
    if (!overlapping.length) {
      result.push(b);
      continue;
    }
    // Keep the parts of b that are not covered by any overlay span
    let cur = b.start;
    for (const o of overlapping.sort((x, y) => x.start - y.start)) {
      if (o.start > cur) result.push({ start: cur, end: o.start, cls: b.cls });
      cur = Math.max(cur, o.end);
    }
    if (cur < b.end) result.push({ start: cur, end: b.end, cls: b.cls });
  }

  // Append overlay spans
  for (const o of overlay) result.push(o);

  return result.sort((a, b) => a.start - b.start);
}

function buildHighlightedHtml(code, lang, allParsers) {
  const { parser, query, injectionQuery } = allParsers[lang];

  // Primary MFront/MTest highlights
  const baseHighlights = getHighlights(code, query, parser);

  // C++ injections (mfront only)
  const cppHighlights = [];
  if (injectionQuery) {
    const tree = parser.parse(code);
    const injCaptures = injectionQuery.captures(tree.rootNode);

    // Only keep injection.content captures whose language is cpp
    // (the predicate `#set! injection.language` is metadata — we filter by
    //  checking the capture name which is always "injection.content")
    for (const { name, node } of injCaptures) {
      if (name !== 'injection.content') continue;
      const start = node.startIndex;
      const end   = node.endIndex;
      const snippet = code.slice(start, end);
      const snippetHighlights = getHighlights(
        snippet,
        allParsers.cpp.query,
        allParsers.cpp.parser,
        start
      );
      cppHighlights.push(...snippetHighlights);
    }
  }

  const highlights = mergeHighlights(baseHighlights, cppHighlights);

  // Render HTML
  let html = '';
  let pos = 0;
  for (const { start, end, cls } of highlights) {
    if (start > pos) html += escapeHtml(code.slice(pos, start));
    html += `<span class="${cls}">${escapeHtml(code.slice(start, end))}</span>`;
    pos = end;
  }
  if (pos < code.length) html += escapeHtml(code.slice(pos));

  return html;
}

export default function remarkTreesitter() {
  return async (tree) => {
    const nodes = [];

    visit(tree, 'code', (node) => {
      if (node.lang === 'mfront' || node.lang === 'mtest') nodes.push(node);
    });

    if (nodes.length === 0) return;

    const allParsers = await getParsers();

    for (const node of nodes) {
      const lang = node.lang;
      try {
        const highlighted = buildHighlightedHtml(node.value, lang, allParsers);
        node.type  = 'html';
        node.value = `<pre class="ts-pre ts-pre-${lang}"><code class="ts-code language-${lang}">${highlighted}</code></pre>`;
        delete node.lang;
        delete node.meta;
      } catch (err) {
        console.error(`[remark-treesitter] Error highlighting ${lang} block:`, err);
      }
    }
  };
}
