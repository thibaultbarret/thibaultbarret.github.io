// scripts/verify-threshold-lut.mjs
// Exécuter DEPUIS la racine du projet : node scripts/verify-threshold-lut.mjs
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction.js';

const THRESHOLD_COLORS = [
  [0.298, 0.686, 0.314], // vert
  [1.000, 0.596, 0.000], // orange
  [0.898, 0.224, 0.208], // rouge
];

// Réplique de applyThresholdLut (doit rester identique à l'implémentation)
function applyThresholdLut(lut, sBas, sHaut) {
  lut.removeAllPoints();
  const eps = (sHaut - sBas) * 1e-7;
  const [gr, gg, gb] = THRESHOLD_COLORS[0];
  const [or_, og, ob] = THRESHOLD_COLORS[1];
  const [rr, rg, rb] = THRESHOLD_COLORS[2];
  lut.addRGBPoint(sBas - eps, gr, gg, gb);
  lut.addRGBPoint(sBas,       or_, og, ob);
  lut.addRGBPoint(sHaut - eps, or_, og, ob);
  lut.addRGBPoint(sHaut,      rr, rg, rb);
  lut.setMappingRange(sBas - eps, sHaut);
  lut.updateRange();
}

const near = (a, b) => Math.abs(a - b) < 1e-3;
const colorAt = (lut, v) => { const rgb = [0,0,0]; lut.getColor(v, rgb); return rgb; };
const isGreen  = c => near(c[0],0.298) && near(c[1],0.686) && near(c[2],0.314);
const isOrange = c => near(c[0],1.000) && near(c[1],0.596) && near(c[2],0.000);
const isRed    = c => near(c[0],0.898) && near(c[1],0.224) && near(c[2],0.208);

const lut = vtkColorTransferFunction.newInstance();
const sBas = 0.02, sHaut = 0.05;
applyThresholdLut(lut, sBas, sHaut);

const cases = [
  ['très en dessous',   colorAt(lut, -1),     isGreen],
  ['juste sous sBas',   colorAt(lut, 0.01),   isGreen],
  ['exactement sBas',   colorAt(lut, 0.02),   isOrange],
  ['milieu orange',     colorAt(lut, 0.035),  isOrange],
  ['exactement sHaut',  colorAt(lut, 0.05),   isRed],
  ['au dessus de sHaut',colorAt(lut, 0.1),    isRed],
  ['très au dessus',    colorAt(lut, 100),    isRed],
];

let ok = true;
for (const [label, c, pred] of cases) {
  const pass = pred(c);
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  → rgb(${c.map(x=>x.toFixed(3)).join(',')})`);
}
if (!ok) { console.error('\nÉCHEC : au moins un palier est mal coloré.'); process.exit(1); }
console.log('\nOK : les 3 paliers threshold sont corrects.');
