import { load as loadYaml } from 'js-yaml';

/** Fence ` ```figure ` en début de ligne ; capture le YAML interne. */
const FENCE = /^```figure[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;

/** @typedef {{ filename: string, title: string, slug: string }} FigureDecl */

/** @param {string} inner @returns {FigureDecl} */
export function parseFigureBlock(inner) {
  const data = loadYaml(inner);
  if (!data || typeof data !== 'object') {
    throw new Error('Bloc figure invalide (YAML non-objet).');
  }
  const out = {};
  for (const k of ['filename', 'title', 'slug']) {
    const v = data[k];
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`Bloc figure : clé "${k}" manquante ou vide.`);
    }
    out[k] = v;
  }
  return out;
}

/**
 * Découpe le corps en parts ordonnées (texte / figure).
 * @param {string} body
 * @returns {Array<{kind:'text', content:string} | {kind:'figure', fig:FigureDecl}>}
 */
export function splitBody(body) {
  const parts = [];
  const re = new RegExp(FENCE.source, 'gm'); // fraîche : pas d'état lastIndex partagé
  let last = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', content: body.slice(last, m.index) });
    parts.push({ kind: 'figure', fig: parseFigureBlock(m[1]) });
    last = re.lastIndex;
  }
  if (last < body.length) parts.push({ kind: 'text', content: body.slice(last) });
  return parts;
}

/** @param {string} body @returns {FigureDecl[]} */
export function extractFigures(body) {
  const figs = splitBody(body).filter((p) => p.kind === 'figure').map((p) => p.fig);
  const seen = new Set();
  for (const f of figs) {
    if (seen.has(f.slug)) {
      throw new Error(`Bloc figure : slug dupliqué "${f.slug}" dans le même chapitre.`);
    }
    seen.add(f.slug);
  }
  return figs;
}
