// scripts/verify-histogram-seuils.mjs
// Exécuter DEPUIS la racine du projet : node scripts/verify-histogram-seuils.mjs
// Node ≥ 22 importe directement le .ts : on teste le VRAI module, pas une réplique.
import { thresholdCounts } from '../src/scripts/histogram-math.ts';

const S_BAS = 2, S_HAUT = 4;
const near = (a, b) => Math.abs(a - b) < 1e-12;
const eq3 = (got, want) => got.length === 3 && got.every((v, i) => near(v, want[i]));

const cases = [
  ['répartition simple',
    thresholdCounts([1, 2, 3, 4], S_BAS, S_HAUT), [0.25, 0.5, 0.25]],
  ['pile sur les seuils : sBas → intervalle 1, sHaut → intervalle 2',
    thresholdCounts([2, 4], S_BAS, S_HAUT), [0, 0.5, 0.5]],
  ['non finis exclus du dénominateur',
    thresholdCounts([1, NaN, 3, Infinity, -Infinity], S_BAS, S_HAUT), [0.5, 0.5, 0]],
  ['tout NaN → pas de division par zéro',
    thresholdCounts([NaN, NaN], S_BAS, S_HAUT), [0, 0, 0]],
  ['tableau vide',
    thresholdCounts([], S_BAS, S_HAUT), [0, 0, 0]],
  ['constante sous le seuil bas',
    thresholdCounts([0.5, 0.5, 0.5], S_BAS, S_HAUT), [1, 0, 0]],
  ['constante au-dessus du seuil haut',
    thresholdCounts([9, 9], S_BAS, S_HAUT), [0, 0, 1]],
  ['seuils négatifs',
    thresholdCounts([-5, -3, -1], -4, -2), [1 / 3, 1 / 3, 1 / 3]],
  ['ordres de grandeur réalistes (déformations)',
    thresholdCounts([1e-5, 2e-4, 9e-4, 3e-3], 1e-4, 5e-4), [0.25, 0.25, 0.5]],
];

let ok = true;
for (const [label, got, want] of cases) {
  const pass = eq3(got, want);
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}\n        attendu [${want.join(', ')}]  obtenu [${got.join(', ')}]`);
}

// La somme vaut 1 dès qu'il existe au moins un point fini.
const sum = thresholdCounts([1, 2, 3, 4, NaN], S_BAS, S_HAUT).reduce((a, b) => a + b, 0);
const sumOk = near(sum, 1);
if (!sumOk) ok = false;
console.log(`${sumOk ? 'PASS' : 'FAIL'}  somme des fractions = 1 (obtenu ${sum})`);

if (!ok) { console.error('\nÉCHEC : thresholdCounts ne respecte pas la convention de bornes.'); process.exit(1); }
console.log('\nOK : thresholdCounts conforme.');
