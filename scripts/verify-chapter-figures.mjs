import assert from 'node:assert/strict';
import { parseFigureBlock, splitBody, extractFigures } from '../src/lib/chapter-figures.mjs';

// bloc valide
assert.deepEqual(
  parseFigureBlock('filename: "a.json"\ntitle: "Figure 1 — X"\nslug: "x"'),
  { filename: 'a.json', title: 'Figure 1 — X', slug: 'x' }
);

// slug manquant -> erreur mentionnant slug
assert.throws(() => parseFigureBlock('filename: "a.json"\ntitle: "t"'), /slug/);

// title vide -> erreur
assert.throws(() => parseFigureBlock('filename: "a.json"\ntitle: ""\nslug: "s"'), /title/);

// découpage + extraction ordonnée
const body = [
  'Intro.', '',
  '```figure', 'filename: "a.json"', 'title: "Figure 1"', 'slug: "a"', '```', '',
  'Milieu.', '',
  '```figure', 'filename: "b.json"', 'title: "Figure 2"', 'slug: "b"', '```', '',
  'Fin.',
].join('\n');

const parts = splitBody(body);
assert.equal(parts.filter(p => p.kind === 'figure').length, 2);
assert.equal(parts[0].kind, 'text');

const figs = extractFigures(body);
assert.deepEqual(figs.map(f => f.slug), ['a', 'b']);
assert.equal(figs[0].filename, 'a.json');

console.log('OK chapter-figures');
