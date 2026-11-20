// scripts/verify-vtk-player.mjs
// Exécuter DEPUIS la racine du projet : node scripts/verify-vtk-player.mjs
// Import direct du .ts (Node ≥ 22.18 / 23.6) : on teste le VRAI module.
import {
  createRenderScheduler, nextFrameDelay, clampZoomOut, FRAME_MS, MAX_ZOOM_OUT,
} from '../src/scripts/player-core.ts';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const DELAYS = [50, 5, 30, 1];
const eqPos = (a, b) => !!a && a.step === b.step && a.field === b.field;

let ok = true;
const check = (label, pass, detail = '') => {
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
};

// Rendus factices de durées variables : le dernier demandé doit gagner.
{
  const log = [];
  const s = createRenderScheduler(async step => { await sleep(DELAYS[step]); log.push(step); },
    { step: 0, field: 0 }, () => {});
  s.request(1, 0); s.request(2, 0);
  await s.request(3, 0);
  check('dernier demandé affiché en dernier',
    log.at(-1) === 3 && eqPos(s.shown(), { step: 3, field: 0 }), `log = [${log}]`);
  check('pas de rendu périmé après un plus récent',
    log.indexOf(3) === log.length - 1, `log = [${log}]`);
}

{
  let calls = 0;
  const s = createRenderScheduler(async () => { calls++; }, { step: 0, field: 0 }, () => {});
  await s.request(0, 0);
  check('pas de rendu si déjà affiché', calls === 0, `appels = ${calls}`);
}

{
  let errors = 0;
  const s = createRenderScheduler(async step => {
    await sleep(2);
    if (step === 1) throw new Error('réseau');
  }, { step: 0, field: 0 }, () => { errors++; });
  await s.request(1, 0);
  await s.request(2, 0);
  check('un échec ne bloque pas',
    errors === 1 && eqPos(s.shown(), { step: 2, field: 0 }), `erreurs = ${errors}, shown = ${JSON.stringify(s.shown())}`);
}

{
  let calls = 0;
  const s = createRenderScheduler(async () => { calls++; await sleep(1); }, { step: 0, field: 0 }, () => {});
  await s.request(0, 3);
  check('changement de composante seule déclenche un rendu',
    calls === 1 && eqPos(s.shown(), { step: 0, field: 3 }));
}

check('constantes', FRAME_MS === 200 && MAX_ZOOM_OUT === 2);
check('nextFrameDelay', nextFrameDelay(0) === 200 && nextFrameDelay(150) === 50 && nextFrameDelay(350) === 0,
  `[${nextFrameDelay(0)}, ${nextFrameDelay(150)}, ${nextFrameDelay(350)}]`);
check('clampZoomOut', clampZoomOut(1, 1) === 1 && clampZoomOut(3, 1) === 2 && clampZoomOut(2, 1) === 2);
check('bornage idempotent', clampZoomOut(clampZoomOut(5, 1), 1) === clampZoomOut(5, 1));

if (!ok) { console.error('\nÉCHEC : logique du lecteur non conforme.'); process.exit(1); }
console.log('\nOK : logique du lecteur conforme.');
