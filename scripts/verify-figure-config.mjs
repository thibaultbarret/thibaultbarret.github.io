// scripts/verify-figure-config.mjs
// Exécuter DEPUIS la racine du projet : node scripts/verify-figure-config.mjs
// Import direct du .ts (Node ≥ 22.18 / 23.6) : on teste le VRAI module.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeFigureConfig } from '../src/scripts/figure-config.ts';

const D = '/data/a';
const PATH_KEYS = new Set(['coords', 'triangles', 'triangulation', 'connectivity', 'fields',
  'displacements', 'images', 'image', 'data', 'x', 'y']);
const norm = normalizeFigureConfig;

let ok = true;
function check(label, fn) {
  try { fn(); console.log(`PASS  ${label}`); }
  catch (e) { ok = false; console.log(`FAIL  ${label}\n        ${e.message.split('\n')[0]}`); }
}

check('jointure', () => {
  assert.deepEqual(norm({ dossier: D, coords: 'c.npy' }), { coords: '/data/a/c.npy' });
  assert.deepEqual(norm({ dossier: '/data/a/', coords: 'c.npy' }), { coords: '/data/a/c.npy' });
});
check('absolu, http, data: inchangés', () => {
  const cfg = { dossier: D, coords: '/x/c.npy', fields: 'https://h/f.npy', image: 'data:image/png;base64,AA' };
  assert.deepEqual(norm(cfg), { coords: '/x/c.npy', fields: 'https://h/f.npy', image: 'data:image/png;base64,AA' });
});
check('dossier imbriqué remplace', () => {
  const r = norm({ dossier: D, panels: [{ dossier: '/data/b', fields: 'f.npy' }, { fields: 'g.npy' }] });
  assert.equal(r.panels[0].fields, '/data/b/f.npy');
  assert.equal(r.panels[1].fields, '/data/a/g.npy');
  assert.ok(!('dossier' in r.panels[0]));
});
check('dossier imbriqué relatif', () => {
  assert.equal(norm({ dossier: D, panels: [{ dossier: 'p1', fields: 'f.npy' }] }).panels[0].fields, '/data/a/p1/f.npy');
});
check('clés non-chemin intactes', () => {
  const r = norm({ dossier: D, coords: 'c.npy', title: 't.npy', fields_config: [{ index: 0, name: 'n.png' }],
    steps: [{ step: 0, text: 'a.png' }] });
  assert.equal(r.title, 't.npy');
  assert.equal(r.fields_config[0].name, 'n.png');
  assert.equal(r.steps[0].text, 'a.png');
});
check('tableau x intact', () => {
  const r = norm({ dossier: D, x: [1, 2, 3], curves: [{ y: 'y.npy' }] });
  assert.deepEqual(r.x, [1, 2, 3]);
  assert.equal(r.curves[0].y, '/data/a/y.npy');
});
check('steps numérique', () => {
  assert.deepEqual(norm({ steps: 3 }), { steps: [{ step: 0 }, { step: 1 }, { step: 2 }] });
});
check('image_pas {pas+1}', () => {
  const r = norm({ dossier: D, image_pas: 's_{pas+1}.png', steps: 2 });
  assert.deepEqual(r.steps.map(s => s.image), ['/data/a/s_1.png', '/data/a/s_2.png']);
});
check('image_pas {pas}', () => {
  const r = norm({ dossier: D, image_pas: 's_{pas}.png', steps: 2 });
  assert.deepEqual(r.steps.map(s => s.image), ['/data/a/s_0.png', '/data/a/s_1.png']);
});
check('image_pas fixe', () => {
  const r = norm({ dossier: D, image_pas: 's_0.png', steps: 3 });
  assert.deepEqual(r.steps.map(s => s.image), Array(3).fill('/data/a/s_0.png'));
});
check('image propre prioritaire', () => {
  const r = norm({ dossier: D, image_pas: 's_{pas}.png', steps: [{ step: 0, image: 'x.png' }, { step: 1 }] });
  assert.deepEqual(r.steps.map(s => s.image), ['/data/a/x.png', '/data/a/s_1.png']);
});
check('liste avec text + image_pas', () => {
  const r = norm({ dossier: D, image_pas: 's_{pas+1}.png', steps: [{ step: 4, text: { 0: 't' } }] });
  assert.deepEqual(r.steps, [{ step: 4, text: { 0: 't' }, image: '/data/a/s_5.png' }]);
});
check('clés retirées', () => {
  const r = norm({ dossier: D, image_pas: 's.png', steps: 1 });
  assert.ok(!('dossier' in r) && !('image_pas' in r));
});
check('entrée non modifiée', () => {
  const cfg = { dossier: D, image_pas: 's_{pas}.png', steps: 2, panels: [{ dossier: 'p', coords: 'c.npy' }] };
  const before = JSON.stringify(cfg);
  norm(cfg);
  assert.equal(JSON.stringify(cfg), before);
});

check('erreur : relatif sans dossier', () => assert.throws(() => norm({ coords: 'c.npy' }), /coords/));
check('erreur : dossier racine relatif', () => assert.throws(() => norm({ dossier: 'data/a', coords: 'c.npy' }), /dossier/));
check('erreur : steps 0', () => assert.throws(() => norm({ steps: 0 }), /steps/));
check('erreur : steps 2.5', () => assert.throws(() => norm({ steps: 2.5 }), /steps/));
check('erreur : image_pas sans steps', () => assert.throws(() => norm({ dossier: D, image_pas: 's.png' }), /image_pas/));
check('erreur : image_pas avec images', () =>
  assert.throws(() => norm({ dossier: D, image_pas: 's.png', images: 'i.npy', steps: 1 }), /images/));
check('erreur : image_pas avec images dans un panneau', () =>
  assert.throws(() => norm({ dossier: D, image_pas: 's.png', steps: 1, panels: [{ coords: 'c.npy', images: 'i.npy' }] }), /images/));

// Fichiers réels du dépôt
const DIR = 'public/figures/manuscrit';
const files = readdirSync(DIR).filter(f => f.endsWith('.json'));
function walk(o, key, visit) {
  if (Array.isArray(o)) o.forEach(v => walk(v, key, visit));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, k, visit));
  else visit(key, o);
}
for (const f of files) {
  const json = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  if (!('dossier' in json)) check(`ancien format inchangé : ${f}`, () => assert.deepEqual(norm(json), json));
  check(`aucun chemin relatif : ${f}`, () => walk(norm(json), null, (k, v) => {
    if (PATH_KEYS.has(k) && typeof v === 'string') assert.match(v, /^(\/|https?:|data:)/, `${k} = ${v}`);
  }));
}

if (!ok) { console.error('\nÉCHEC : normalisation des configs de figure non conforme.'); process.exit(1); }
console.log(`\nOK : normalisation conforme (${files.length} fichiers réels).`);
