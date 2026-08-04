# Histogramme à 3 intervalles (seuils) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un type de figure « histogramme à 3 intervalles » : pour un champ et un instant donnés, la fraction de points sous `seuil_bas`, entre les deux seuils et au-dessus de `seuil_haut`, avec N jeux de données comparés en barres groupées.

**Architecture:** Un type de figure autonome (composant + runtime dédiés), détecté dans la route `[figSlug].astro` par la clé JSON `histogram_seuils`. Le comptage est une fonction pure ajoutée à `histogram-math.ts` (sans import runtime, donc exécutable dans Node). Le chargement `.npy`, le formatage et le rendu KaTeX viennent des modules déjà partagés (`vtk-core.ts`, `plot1d-runtime.ts`). Le tracé est un dessin manuel dans le hook `draw` d'uPlot, qui ne fournit que les échelles, les axes et la grille — exactement comme l'histogramme existant.

**Tech Stack:** Astro 5, TypeScript, uPlot 1.6, KaTeX, Node 26.

**Spec:** `docs/superpowers/specs/2026-08-04-histogramme-seuils-design.md`

## Global Constraints

- Branche de travail : `feat/histogram-seuils`, déjà créée, déjà porteuse du commit de spec. **Ne jamais pousser** vers `origin`.
- **Ne toucher à aucun fichier de contenu** : `src/content/chapters/*.md`, les `.npy` de `public/data/`, les figures JSON existantes. L'utilisateur les édite à la main en parallèle. Un seul JSON est créé, il est nouveau.
- Convention de bornes, non négociable, identique à `applyThresholdLut` de `vtk-core.ts` : `v < seuil_bas` | `seuil_bas ≤ v < seuil_haut` | `v ≥ seuil_haut`.
- Palette par défaut, ordre fixe, **jamais cyclée** : `#4e87e5 #cf6912 #099f8f #9f6dd4 #ab8309 #d25b80`. Au-delà de six jeux sans `color` explicite → erreur affichée, pas une septième teinte inventée.
- Les valeurs non finies (NaN, ±Infinity) ne sont ni comptées ni au dénominateur.
- Pas de framework de test dans ce dépôt : la vérification passe par des scripts Node dans `scripts/` et par une inspection en navigateur headless.
- Commits petits et cadrés, un par tâche, message en français, préfixe conventionnel.

---

## Structure des fichiers

| Fichier | Nature | Responsabilité |
|---|---|---|
| `src/scripts/histogram-math.ts` | modifié | Math pure. Reçoit `thresholdCounts`. Aucun import runtime. |
| `scripts/verify-histogram-seuils.mjs` | créé | Vérifie `thresholdCounts` dans Node. |
| `src/scripts/histogram-seuils-runtime.ts` | créé | Chargement, validation, état, dessin, légende, contrôles, survol. |
| `src/components/HistogramSeuils.astro` | créé | Markup, styles, init paresseuse par `IntersectionObserver`. |
| `src/pages/manuscrit/[chapterSlug]/[figSlug].astro` | modifié | Détection du type + branche de rendu. |
| `public/figures/manuscrit/histogram_seuils_taille_elt.json` | créé | Figure de démonstration sur données réelles. |
| `src/pages/verif-histogram-seuils.astro` | créé puis **supprimé** (Tâche 5) | Page temporaire pour la vérification visuelle. |

---

### Task 1 : `thresholdCounts` et sa vérification

**Files:**
- Create: `scripts/verify-histogram-seuils.mjs`
- Modify: `src/scripts/histogram-math.ts` (ajout en fin de fichier)

**Interfaces:**
- Consumes: rien.
- Produces: `thresholdCounts(values: ArrayLike<number>, sBas: number, sHaut: number): [number, number, number]` — fractions normalisées `[< sBas, [sBas, sHaut), ≥ sHaut]`, somme 1, ou `[0, 0, 0]` si aucune valeur finie. Consommé par la Tâche 2.

Note : Node 26 importe directement un `.ts`. Le script de vérification importe donc le **vrai** module, contrairement à `verify-threshold-lut.mjs` qui doit répliquer son implémentation (il dépend de vtk.js). Aucune duplication ici.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `scripts/verify-histogram-seuils.mjs` :

```js
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
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node scripts/verify-histogram-seuils.mjs`
Expected: ÉCHEC — `thresholdCounts is not a function` (l'export n'existe pas encore).

- [ ] **Step 3 : Écrire l'implémentation minimale**

Ajouter en fin de `src/scripts/histogram-math.ts` :

```ts
// Fractions normalisées de points par intervalle de seuils :
//   [ v < sBas , sBas <= v < sHaut , v >= sHaut ].
// Bornes IDENTIQUES à applyThresholdLut (vtk-core.ts) : l'histogramme et la carte
// de champ en mode `threshold` doivent classer chaque point de la même façon.
// Non finis (NaN, ±Infinity) ignorés : ni comptés, ni au dénominateur.
// Somme = 1, ou [0,0,0] si aucun point fini.
export function thresholdCounts(
  values: ArrayLike<number>, sBas: number, sHaut: number,
): [number, number, number] {
  let lo = 0, mid = 0, hi = 0;
  for (let k = 0; k < values.length; k++) {
    const v = values[k];
    if (!isFinite(v)) continue;
    if (v < sBas) lo++;
    else if (v < sHaut) mid++;
    else hi++;
  }
  const total = lo + mid + hi;
  if (total === 0) return [0, 0, 0];
  return [lo / total, mid / total, hi / total];
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `node scripts/verify-histogram-seuils.mjs`
Expected: dix lignes `PASS` puis `OK : thresholdCounts conforme.`, code de sortie 0.

- [ ] **Step 5 : Commit**

```bash
git add src/scripts/histogram-math.ts scripts/verify-histogram-seuils.mjs
git commit -m "feat(histogram-seuils): comptage des 3 intervalles + vérification Node"
```

---

### Task 2 : Composant, runtime et affichage des barres

**Files:**
- Create: `src/scripts/histogram-seuils-runtime.ts`
- Create: `src/components/HistogramSeuils.astro`
- Create: `public/figures/manuscrit/histogram_seuils_taille_elt.json`
- Create: `src/pages/verif-histogram-seuils.astro`
- Modify: `src/pages/manuscrit/[chapterSlug]/[figSlug].astro:33-53` (détection) et `:82-120` (rendu)

**Interfaces:**
- Consumes: `thresholdCounts` (Tâche 1) ; `fetchNpy`, `idx`, `formatValue`, `NpyArray` de `./vtk-core` ; `renderTex` de `./plot1d-runtime`.
- Produces:
  - `initHistogramSeuils(el: HTMLElement): Promise<void>` — consommé par le composant.
  - `HS_PALETTE: string[]` — six couleurs, ordre fixe.
  - Les classes DOM `.hs-figure .hs-loading .hs-error .hs-tooltip .hs-fields .hs-host .hs-ylabel .hs-ylabel-inner .hs-uplot .hs-legend .hs-controls .hs-slider .hs-datalist .hs-label .hs-first .hs-prev .hs-play .hs-next .hs-last` — la légende est remplie en Tâche 3, les contrôles câblés en Tâche 4. Le markup complet est posé **ici** pour que ces tâches n'aient plus qu'à écrire du runtime.

- [ ] **Step 1 : Créer le runtime**

Créer `src/scripts/histogram-seuils-runtime.ts` :

```ts
// src/scripts/histogram-seuils-runtime.ts
// Histogramme à 3 intervalles de seuils, N jeux de données en barres groupées.
// Config JSON via el.dataset.src :
//   { histogram_seuils:true, seuil_bas, seuil_haut,
//     datasets:[{ data, name, color?, hatch? }],
//     fields_config?, y_label?, x_labels? }
// Les .npy sont de forme (N, F, S) ou (N, S).
import uPlot from 'uplot';
import { fetchNpy, idx, formatValue, type NpyArray } from './vtk-core';
import { thresholdCounts } from './histogram-math';
import { renderTex } from './plot1d-runtime';

// Palette catégorielle validée contre le fond #1e1e2e (skill dataviz) : teintes
// Catppuccin ramenées dans la bande de luminosité du mode sombre. Ordre fixe,
// JAMAIS cyclé — au-delà de six jeux il faut des `color` explicites.
export const HS_PALETTE = ['#4e87e5', '#cf6912', '#099f8f', '#9f6dd4', '#ab8309', '#d25b80'];

type DatasetDef = { data: string; name: string; color?: string; hatch?: boolean };
type FieldDef = { index: number; name: string };
type Loaded = { def: DatasetDef; npy: NpyArray; color: string; hatch: boolean };

// Tolère un nombre OU une chaîne numérique ("1e-4"), comme les bornes des
// autres figures.
function parseBound(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return (typeof n === 'number' && isFinite(n)) ? n : null;
}

// data[:, comp, step] (ou data[:, step] si 2D) → vecteur longueur N.
function extractSlice(npy: NpyArray, comp: number, step: number): number[] {
  const N = npy.shape[0];
  const out = new Array<number>(N);
  const is3d = npy.shape.length >= 3;
  for (let p = 0; p < N; p++) {
    out[p] = is3d ? Number(idx(npy.data, npy.shape, p, comp, step))
                  : Number(idx(npy.data, npy.shape, p, step));
  }
  return out;
}

const stepsOf = (n: NpyArray) => n.shape[n.shape.length - 1];
const compsOf = (n: NpyArray) => (n.shape.length >= 3 ? n.shape[1] : 1);

// Note : la part du pas occupée par un groupe est calculée par figure, dans
// `initHistogramSeuils`, à partir du nombre de jeux (`groupFill`, ci-dessous) —
// le creux entre groupes vaut toujours la largeur d'une barre.

export async function initHistogramSeuils(el: HTMLElement): Promise<void> {
  const loading = el.querySelector<HTMLElement>('.hs-loading')!;
  const errEl   = el.querySelector<HTMLElement>('.hs-error')!;
  const mount   = el.querySelector<HTMLElement>('.hs-uplot')!;
  const ylabelEl = el.querySelector<HTMLElement>('.hs-ylabel-inner')!;
  const ylabelCell = el.querySelector<HTMLElement>('.hs-ylabel')!;

  const fail = (msg: string) => {
    loading.style.display = 'none';
    mount.style.visibility = 'hidden';
    errEl.textContent = `⚠ ${msg}`;
    errEl.style.display = 'flex';
  };

  const cfg = await fetch(el.dataset.src!).then(r => r.json());

  // ── Validation de la configuration ───────────────────────────────────────
  const sBas = parseBound(cfg.seuil_bas), sHaut = parseBound(cfg.seuil_haut);
  if (sBas == null || sHaut == null) {
    return fail(`seuils illisibles : seuil_bas = ${JSON.stringify(cfg.seuil_bas)}, seuil_haut = ${JSON.stringify(cfg.seuil_haut)}.`);
  }
  if (!(sBas < sHaut)) {
    return fail(`seuil_bas doit être strictement inférieur à seuil_haut (lus : ${sBas} et ${sHaut}).`);
  }

  const defs: DatasetDef[] = Array.isArray(cfg.datasets) ? cfg.datasets : [];
  if (defs.length === 0) return fail('aucun jeu de données déclaré (`datasets` absent ou vide).');
  const sansCouleur = defs.findIndex((d, i) => !d.color && i >= HS_PALETTE.length);
  if (sansCouleur >= 0) {
    return fail(`${defs.length} jeux déclarés mais la palette n'en tient que ${HS_PALETTE.length} : donner un \`color\` explicite au jeu « ${defs[sansCouleur].name ?? defs[sansCouleur].data} » ou scinder la figure.`);
  }

  const fieldsConfig: FieldDef[] = (Array.isArray(cfg.fields_config) && cfg.fields_config.length > 0)
    ? cfg.fields_config
    : [{ index: 0, name: 'Champ' }];

  // ── Chargement des .npy (en parallèle, erreur nommant le fichier fautif) ──
  let npys: NpyArray[];
  try {
    npys = await Promise.all(defs.map(d => fetchNpy(d.data).catch(() => {
      throw new Error(`chargement impossible du fichier « ${d.data} ».`);
    })));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  // ── Cohérence entre jeux ─────────────────────────────────────────────────
  const S = stepsOf(npys[0]);
  const mauvaisPas = npys.findIndex(n => stepsOf(n) !== S);
  if (mauvaisPas > 0) {
    return fail(`nombres d'instants incompatibles : « ${defs[0].data} » en a ${S}, « ${defs[mauvaisPas].data} » en a ${stepsOf(npys[mauvaisPas])}.`);
  }
  for (let i = 0; i < defs.length; i++) {
    for (const f of fieldsConfig) {
      if (f.index >= compsOf(npys[i])) {
        return fail(`composante ${f.index} (${f.name}) absente de « ${defs[i].data} », qui n'en porte que ${compsOf(npys[i])}.`);
      }
    }
  }

  const loaded: Loaded[] = defs.map((def, i) => ({
    def, npy: npys[i],
    color: def.color ?? HS_PALETTE[i],
    hatch: def.hatch === true,
  }));

  // ── Étiquettes ───────────────────────────────────────────────────────────
  const yLabel: string = cfg.y_label ?? 'Fraction de points';
  const fmtSeuil = (v: number) => formatValue(v, '.1e');
  const xLabels: string[] = (Array.isArray(cfg.x_labels) && cfg.x_labels.length === 3)
    ? cfg.x_labels
    : [`< ${fmtSeuil(sBas)}`, `[${fmtSeuil(sBas)}, ${fmtSeuil(sHaut)}[`, `≥ ${fmtSeuil(sHaut)}`];
  if (yLabel) { renderTex(ylabelEl, yLabel, true); ylabelCell.style.display = 'block'; }

  loading.style.display = 'none';

  // ── État partagé (lu par les hooks d'uPlot) ──────────────────────────────
  let currentField = fieldsConfig[0].index;
  let currentStep = 0;
  // fractions[jeu][intervalle]
  let fractions: [number, number, number][] = loaded.map(() => [0, 0, 0]);
  let u: uPlot | null = null;

  function buildPlot() {
    const opts: uPlot.Options = {
      width: mount.clientWidth || 300,
      height: mount.clientHeight || 200,
      cursor: { drag: { x: false, y: false }, points: { show: false } },
      legend: { show: false },
      scales: {
        // Axe catégoriel : les trois intervalles aux abscisses 0, 1, 2.
        x: { time: false, range: () => [-0.5, 2.5] as uPlot.Range.MinMax },
        y: { range: [0, 1], auto: false },
      },
      axes: [
        { stroke: '#a6adc8', grid: { show: false }, ticks: { stroke: '#45475a' },
          splits: () => [0, 1, 2], values: () => xLabels, font: '11px monospace', size: 34 },
        { stroke: '#a6adc8', grid: { stroke: '#313244', width: 1 }, ticks: { stroke: '#45475a' },
          values: (_u, sp) => sp.map(v => `${Math.round(v * 100)} %`), font: '11px monospace' },
      ],
      series: [{}, { paths: () => null, points: { show: false } }],
      hooks: {
        draw: [(self) => {
          const ctx = self.ctx;
          const bb = self.bbox;
          const y0 = self.valToPos(0, 'y', true);
          const pas = Math.abs(self.valToPos(1, 'x', true) - self.valToPos(0, 'x', true));
          const groupW = pas * groupFill;
          const barW = groupW / loaded.length;
          ctx.save();
          ctx.beginPath(); ctx.rect(bb.left, bb.top, bb.width, bb.height); ctx.clip();
          for (let g = 0; g < 3; g++) {
            const xc = self.valToPos(g, 'x', true);
            for (let d = 0; d < loaded.length; d++) {
              // 2 px de fond entre deux barres voisines (1 px de marge de chaque côté).
              const x = xc - groupW / 2 + d * barW + 1;
              const w = Math.max(1, barW - 2);
              const yT = self.valToPos(fractions[d][g], 'y', true);
              ctx.fillStyle = loaded[d].color;
              ctx.fillRect(x, yT, w, y0 - yT);
              ctx.strokeStyle = '#11111b'; ctx.lineWidth = 1;
              ctx.strokeRect(x, yT, w, y0 - yT);
            }
          }
          ctx.restore();
        }],
      },
    };
    u = new uPlot(opts, [[0, 1, 2], [null, null, null]] as unknown as uPlot.AlignedData, mount);
  }

  function render() {
    fractions = loaded.map(l => thresholdCounts(extractSlice(l.npy, currentField, currentStep), sBas!, sHaut!));
    if (!u) buildPlot(); else u.redraw();
  }

  new ResizeObserver(() => { if (u) u.setSize({ width: mount.clientWidth, height: mount.clientHeight }); }).observe(mount);

  render();
}
```

- [ ] **Step 2 : Créer le composant**

Créer `src/components/HistogramSeuils.astro` :

```astro
---
// Figure histogramme à 3 intervalles de seuils (uPlot). Config JSON via `src`,
// schéma : { histogram_seuils:true, seuil_bas, seuil_haut,
//            datasets:[{data,name,color?,hatch?}], fields_config?, y_label?, x_labels? }
interface Props { src: string; height?: number | string; }
const { src, height = 420 } = Astro.props;
const heightCss = typeof height === 'string' ? height : `${height}px`;
---

<div
  class="hs-figure"
  data-src={src}
  style={`height:${heightCss}; position:relative; background:#1e1e2e; border-radius:0.25rem; overflow:hidden;`}
>
  <div class="hs-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;">
    <span style="color:#a6adc8;font:12px monospace;">Chargement…</span>
  </div>

  <div class="hs-fields" style="display:none;position:absolute;top:10px;right:10px;gap:6px;flex-wrap:wrap;justify-content:flex-end;z-index:16;"></div>

  <div class="hs-error" style="display:none;position:absolute;inset:0;z-index:15;pointer-events:none;background:#1e1e2e;color:#f38ba8;font:13px/1.5 system-ui,sans-serif;padding:1.5rem;align-items:center;justify-content:center;text-align:center;"></div>

  <div class="hs-tooltip" style="display:none;position:absolute;pointer-events:none;z-index:14;background:rgba(24,24,37,.92);border:1px solid #45475a;border-radius:4px;padding:3px 7px;color:#cdd6f4;font:11px monospace;white-space:nowrap;text-align:center;"></div>

  <div class="hs-host" style="position:absolute;inset:8px 8px 44px 8px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr auto;gap:4px;box-sizing:border-box;">
    <div class="hs-ylabel" style="grid-column:1;grid-row:1;display:none;position:relative;width:1.7em;color:#cdd6f4;">
      <span class="hs-ylabel-inner" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-90deg);white-space:nowrap;"></span>
    </div>
    <div class="hs-uplot" style="grid-column:2;grid-row:1;position:relative;min-width:0;min-height:0;"></div>
    <div class="hs-legend" style="grid-column:2;grid-row:2;display:none;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center;color:#cdd6f4;font:11px monospace;"></div>
  </div>

  <div class="hs-controls" style="display:none;position:absolute;left:8px;right:8px;bottom:8px;align-items:center;gap:6px;z-index:16;background:rgba(24,24,37,.85);padding:6px 8px;border-radius:4px;">
    <button class="hs-first" title="Premier pas"   style="background:#313244;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:11px;width:24px;height:24px;cursor:pointer;padding:0;">⏮</button>
    <button class="hs-prev"  title="Pas précédent" style="background:#313244;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:11px;width:24px;height:24px;cursor:pointer;padding:0;">⏪</button>
    <button class="hs-play"  title="Lecture"       style="background:#313244;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:11px;width:24px;height:24px;cursor:pointer;padding:0;">▶</button>
    <button class="hs-next"  title="Pas suivant"   style="background:#313244;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:11px;width:24px;height:24px;cursor:pointer;padding:0;">⏩</button>
    <button class="hs-last"  title="Dernier pas"   style="background:#313244;border:1px solid #45475a;border-radius:4px;color:#cdd6f4;font-size:11px;width:24px;height:24px;cursor:pointer;padding:0;">⏭</button>
    <input class="hs-slider" type="range" min="0" max="0" step="1" value="0" style="flex:1;accent-color:#89b4fa;height:4px;" />
    <datalist class="hs-datalist"></datalist>
    <span class="hs-label" style="color:#a6adc8;font:10px monospace;white-space:nowrap;">1/1</span>
  </div>
</div>

<script>
import 'uplot/dist/uPlot.min.css';
import 'katex/dist/katex.min.css';
import { initHistogramSeuils } from '../scripts/histogram-seuils-runtime';

function setup() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      (target as HTMLElement).dataset.ready = '1';
      obs.unobserve(target);
      initHistogramSeuils(target as HTMLElement).catch(e => {
        const div = (target as HTMLElement).querySelector<HTMLElement>('.hs-loading')!;
        const msg = e instanceof Error ? e.message : String(e);
        div.style.display = 'flex';
        div.innerHTML = `<span style="color:#f38ba8;font:11px monospace;padding:16px;text-align:center;max-width:80%;">Erreur histogramme : ${msg}</span>`;
      });
    });
  }, { threshold: 0.05 });
  document.querySelectorAll<HTMLElement>('.hs-figure:not([data-ready])').forEach(el => obs.observe(el));
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', setup) : setup();
</script>

<style is:global>
  .hs-figure .uplot,
  .hs-figure .u-wrap { background: transparent; }
</style>
```

- [ ] **Step 3 : Créer la figure de démonstration**

Créer `public/figures/manuscrit/histogram_seuils_taille_elt.json` :

```json
{
    "histogram_seuils": true,
    "seuil_bas": "1e-4",
    "seuil_haut": "5e-4",
    "datasets": [
        { "data": "/data/Validation_outil_calcul_deformation_formalisme_cin_locale/Eprouvette_notched/differences_absolues_deformation_cin_ef_taille_elt_1.npy",
          "name": "taille d'élément 1" },
        { "data": "/data/Validation_outil_calcul_deformation_formalisme_cin_locale/Eprouvette_notched/differences_absolues_deformation_cin_ef_taille_elt_2.npy",
          "name": "taille d'élément 2", "hatch": true }
    ],
    "fields_config": [
        { "index": 0, "name": "\\varepsilon_{\\mathrm{xx}}" },
        { "index": 1, "name": "\\varepsilon_{\\mathrm{yy}}" },
        { "index": 2, "name": "\\varepsilon_{\\mathrm{xy}}" },
        { "index": 3, "name": "\\varepsilon_{\\mathrm{1}}" },
        { "index": 4, "name": "\\varepsilon_{\\mathrm{2}}" },
        { "index": 5, "name": "\\varepsilon_{\\mathrm{vm}}" }
    ],
    "y_label": "Fraction de points"
}
```

- [ ] **Step 4 : Créer la page de vérification temporaire**

Elle est nécessaire parce qu'une figure du manuscrit n'a de route que si un bloc ` ```figure ` la déclare dans un chapitre — or les chapitres sont du contenu que l'utilisateur édite lui-même. Cette page est supprimée en Tâche 5.

Créer `src/pages/verif-histogram-seuils.astro` :

```astro
---
import HistogramSeuils from '../components/HistogramSeuils.astro';
import '../styles/global.css';
---
<html lang="fr">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Vérif — histogramme seuils</title></head>
  <body style="background:#181825;padding:24px;">
    <HistogramSeuils src="/figures/manuscrit/histogram_seuils_taille_elt.json" height="600px" />
  </body>
</html>
```

- [ ] **Step 5 : Brancher la détection dans la route**

Dans `src/pages/manuscrit/[chapterSlug]/[figSlug].astro`, ajouter l'import après celui de `Histogram` (ligne 11) :

```ts
import HistogramSeuils from '../../../components/HistogramSeuils.astro';
```

Remplacer le bloc de détection (lignes 33-53) par :

```ts
// Détecte le type de figure VTK d'après les clés du JSON (lu au build).
let isHistSeuils = false;
let isHistogram = false;
let isVtkCompare = false;
let isFieldCurve = false;
let isPlot1D = false;
let isVtk3D = false;
let isVtk   = false;
if (ext === 'json') {
  try {
    const jsonPath = path.join(process.cwd(), 'public', 'figures', 'manuscrit', fig.filename);
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    isHistSeuils = json.histogram_seuils === true;
    isHistogram  = !isHistSeuils && json.histogram === true;
    isVtkCompare = !isHistSeuils && !isHistogram && Array.isArray(json.panels);
    isFieldCurve = !isHistSeuils && !isHistogram && !isVtkCompare && Array.isArray(json.curves) && !!(json.coords || json.triangles);
    isPlot1D     = !isHistSeuils && !isHistogram && !isVtkCompare && !isFieldCurve && Array.isArray(json.curves);
    isVtk3D      = !isHistSeuils && !isHistogram && !isVtkCompare && !isFieldCurve && !isPlot1D && !!(json.dic || json.fe);
    isVtk        = !isHistSeuils && !isHistogram && !isVtkCompare && !isFieldCurve && !isPlot1D && !isVtk3D;
  } catch {
    isVtk = true;
  }
}
```

Ajouter la branche de rendu juste avant celle de `isHistogram` (ligne 85) :

```astro
        {isHistSeuils && (
          <HistogramSeuils src={`/figures/manuscrit/${fig.filename}`} height="calc(100dvh - 260px)" />
        )}
```

Et compléter la garde du repli `iframe` (ligne 110) :

```astro
        {!isHistSeuils && !isHistogram && !isVtkCompare && !isFieldCurve && !isPlot1D && !isVtk && !isVtk3D && !isJs && (
```

- [ ] **Step 6 : Construire et vérifier que le build passe**

Run: `npm run build`
Expected: build vert, aucune erreur TypeScript. La page `verif-histogram-seuils` apparaît dans les routes générées.

- [ ] **Step 7 : Vérification visuelle**

Run: `npm run preview` (port 4321), puis ouvrir `http://localhost:4321/verif-histogram-seuils/` avec la skill `claude-in-chrome` et capturer.

Attendu : trois groupes de deux barres, étiquettes d'axe x `< 1.0e-4`, `[1.0e-4, 5.0e-4[`, `≥ 5.0e-4` ; axe y gradué en pourcentage de 0 à 100 % ; les deux jeux dans les deux premières couleurs de la palette (bleu `#4e87e5`, pêche `#cf6912`) ; le label d'axe y « Fraction de points » à la verticale à gauche ; aucune barre à 0 ni à 100 % (les seuils choisis coupent la distribution en trois). Pas de légende, pas de hachures, pas de contrôles à ce stade — ils arrivent aux tâches suivantes.

Vérification chiffrée de cohérence, à lancer en parallèle :

```bash
node -e '
const fs=require("fs");
const d="public/data/Validation_outil_calcul_deformation_formalisme_cin_locale/Eprouvette_notched/";
for (const f of ["differences_absolues_deformation_cin_ef_taille_elt_1.npy","differences_absolues_deformation_cin_ef_taille_elt_2.npy"]) {
  const b=fs.readFileSync(d+f), hl=b.readUInt16LE(8), off=10+hl;
  const N=25152,F=6,S=50, comp=0, step=0;
  let lo=0,mid=0,hi=0;
  for(let p=0;p<N;p++){const v=b.readDoubleLE(off+8*((p*F+comp)*S+step));
    if(!Number.isFinite(v))continue; if(v<1e-4)lo++; else if(v<5e-4)mid++; else hi++;}
  const t=lo+mid+hi;
  console.log(f.slice(-12), (100*lo/t).toFixed(1)+"%", (100*mid/t).toFixed(1)+"%", (100*hi/t).toFixed(1)+"%");
}'
```

Les trois pourcentages doivent correspondre aux hauteurs lues sur la capture (premier instant, composante ε_xx).

- [ ] **Step 8 : Commit**

```bash
git add src/scripts/histogram-seuils-runtime.ts src/components/HistogramSeuils.astro \
        src/pages/verif-histogram-seuils.astro \
        public/figures/manuscrit/histogram_seuils_taille_elt.json \
        src/pages/manuscrit/\[chapterSlug\]/\[figSlug\].astro
git commit -m "feat(histogram-seuils): composant, runtime et barres groupées"
```

---

### Task 3 : Hachures et légende

**Files:**
- Modify: `src/scripts/histogram-seuils-runtime.ts`

**Interfaces:**
- Consumes: `loaded`, `fractions`, `groupFill` et le hook `draw` de la Tâche 2 ; `renderTex`.
- Produces: `hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null` (interne) et le remplissage de `.hs-legend`, plus `dimLegend(): void` appelé par `render()` — repris en Tâche 4 après chaque changement d'instant ou de composante.

- [ ] **Step 1 : Ajouter le motif de hachures**

Insérer avant `export async function initHistogramSeuils` :

```ts
// Rayures à 45°, tuile 8×8 réutilisée par toutes les barres hachurées.
// Le motif est transparent : il se pose PAR-DESSUS le remplissage de couleur,
// il ne le remplace pas.
let hatchTile: HTMLCanvasElement | null = null;
function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!hatchTile) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d')!;
    g.strokeStyle = 'rgba(17,17,27,0.55)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-2, 10); g.lineTo(10, -2);
    g.moveTo(2, 14);  g.lineTo(14, 2);
    g.stroke();
    hatchTile = c;
  }
  return ctx.createPattern(hatchTile, 'repeat');
}
```

- [ ] **Step 2 : Peindre les hachures dans le hook `draw`**

Dans le hook `draw`, juste après le `ctx.fillRect(x, yT, w, y0 - yT);` du remplissage de couleur et avant le `strokeStyle` :

```ts
              if (loaded[d].hatch) {
                const p = hatchPattern(ctx);
                if (p) { ctx.fillStyle = p; ctx.fillRect(x, yT, w, y0 - yT); }
              }
```

- [ ] **Step 3 : Construire la légende**

Ajouter, dans `initHistogramSeuils`, après la déclaration de `loaded` et avant `buildPlot` :

```ts
  // Légende : pastille peinte du remplissage RÉEL (couleur + motif), nom en
  // encre de texte — l'identité d'un jeu n'est jamais portée par la seule
  // couleur. Une série unique n'a pas de boîte de légende.
  const legendEl = el.querySelector<HTMLElement>('.hs-legend')!;
  const legendItems: HTMLElement[] = [];
  if (loaded.length > 1) {
    loaded.forEach(l => {
      const item = document.createElement('span');
      item.style.cssText = 'display:inline-flex;align-items:center;gap:6px;transition:opacity .15s;';
      const sw = document.createElement('canvas');
      sw.width = 14; sw.height = 14;
      sw.style.cssText = 'width:14px;height:14px;border:1px solid #11111b;border-radius:2px;flex:none;';
      const g = sw.getContext('2d')!;
      g.fillStyle = l.color; g.fillRect(0, 0, 14, 14);
      if (l.hatch) { const p = hatchPattern(g); if (p) { g.fillStyle = p; g.fillRect(0, 0, 14, 14); } }
      const name = document.createElement('span');
      name.style.color = '#cdd6f4';
      renderTex(name, l.def.name, false);
      item.append(sw, name);
      legendEl.appendChild(item);
      legendItems.push(item);
    });
    legendEl.style.display = 'flex';
  }

  // Un jeu sans aucun point fini à l'instant courant : grisé en légende plutôt
  // que silencieusement à zéro.
  function dimLegend() {
    legendItems.forEach((it, i) => {
      const vide = fractions[i][0] + fractions[i][1] + fractions[i][2] === 0;
      it.style.opacity = vide ? '0.45' : '1';
    });
  }
```

- [ ] **Step 4 : Appeler `dimLegend` à chaque rendu**

Dans `render()`, après le calcul de `fractions` :

```ts
    dimLegend();
```

- [ ] **Step 5 : Construire et vérifier**

Run: `npm run build` puis `npm run preview`, ouvrir `http://localhost:4321/verif-histogram-seuils/` avec `claude-in-chrome` et capturer.

Attendu : les barres du second jeu portent des rayures à 45° visibles, celles du premier restent pleines ; sous le graphique, deux entrées de légende « taille d'élément 1 » et « taille d'élément 2 », leurs pastilles reproduisant exactement le remplissage des barres (la seconde hachurée) ; les deux entrées à pleine opacité.

- [ ] **Step 6 : Commit**

```bash
git add src/scripts/histogram-seuils-runtime.ts
git commit -m "feat(histogram-seuils): hachures par jeu et légende avec pastille peinte"
```

---

### Task 4 : Slider, sélecteur de composante et survol

**Files:**
- Modify: `src/scripts/histogram-seuils-runtime.ts`

**Interfaces:**
- Consumes: `currentStep`, `currentField`, `render()`, `dimLegend()`, `fractions`, `loaded`, `xLabels`, `S`, `groupFill` des tâches 2 et 3.
- Produces: rien pour d'autres tâches — c'est la dernière tâche de code.

- [ ] **Step 1 : Ajouter le survol**

Ajouter un hook `setCursor` dans `opts.hooks`, à côté de `draw`. Le test d'appartenance se fait **en coordonnées de valeurs** (`posToVal`), jamais en pixels canvas : cela évite tout écart lié au `devicePixelRatio`.

```ts
        setCursor: [(self) => {
          const { left, top } = self.cursor;
          if (left == null || top == null || left < 0) { tooltip.style.display = 'none'; return; }
          const vx = self.posToVal(left, 'x');
          const g = Math.round(vx);
          if (g < 0 || g > 2 || Math.abs(vx - g) > groupFill / 2) { tooltip.style.display = 'none'; return; }
          // Position dans le groupe → indice du jeu.
          const frac = (vx - (g - groupFill / 2)) / groupFill;
          const d = Math.min(loaded.length - 1, Math.max(0, Math.floor(frac * loaded.length)));
          const vy = self.posToVal(top, 'y');
          const h = fractions[d][g];
          if (vy < 0 || vy > h) { tooltip.style.display = 'none'; return; }

          const key = `${g}|${d}`;
          if (tooltip.dataset.key !== key) {
            tooltip.dataset.key = key;
            tooltip.innerHTML = '<span class="hs-tt-name"></span><br><span class="hs-tt-int"></span><br><span class="hs-tt-val"></span>';
            renderTex(tooltip.querySelector<HTMLElement>('.hs-tt-name'), loaded[d].def.name, false);
            tooltip.querySelector<HTMLElement>('.hs-tt-int')!.textContent = xLabels[g];
          }
          tooltip.querySelector<HTMLElement>('.hs-tt-val')!.textContent = `${(h * 100).toFixed(1)} %`;
          tooltip.style.display = 'block';
          const orect = (self as any).over.getBoundingClientRect();
          const frect = el.getBoundingClientRect();
          tooltip.style.left = `${orect.left - frect.left + left + 12}px`;
          tooltip.style.top  = `${orect.top  - frect.top  + top  + 12}px`;
        }],
```

Déclarer `tooltip` en tête de `initHistogramSeuils`, à côté des autres éléments :

```ts
  const tooltip = el.querySelector<HTMLElement>('.hs-tooltip')!;
```

Le pourcentage est réécrit à chaque déplacement (il change avec l'instant) mais le nom KaTeX n'est re-rendu que lorsque la barre survolée change — d'où le `dataset.key`.

- [ ] **Step 2 : Ajouter le sélecteur de composante**

Après la construction de la légende, avant `render()` :

```ts
  // Sélecteur de composante, identique aux autres figures de champ.
  const fieldsDiv = el.querySelector<HTMLElement>('.hs-fields')!;
  if (fieldsConfig.length > 1) {
    fieldsDiv.style.display = 'flex';
    fieldsConfig.forEach(({ index, name }) => {
      const btn = document.createElement('button');
      btn.dataset.idx = String(index);
      renderTex(btn, name, false);
      const active = index === currentField;
      btn.style.cssText = `padding:3px 10px;font:11px monospace;border-radius:4px;cursor:pointer;border:1px solid #45475a;background:${active ? '#89b4fa' : '#313244'};color:${active ? '#1e1e2e' : '#cdd6f4'};`;
      btn.addEventListener('click', () => {
        stopAnim();
        fieldsDiv.querySelectorAll('button').forEach(b => { b.style.background = '#313244'; b.style.color = '#cdd6f4'; });
        btn.style.background = '#89b4fa'; btn.style.color = '#1e1e2e';
        currentField = index;
        render();
      });
      fieldsDiv.appendChild(btn);
    });
  }
```

- [ ] **Step 3 : Ajouter la barre de contrôles**

Juste après, avant l'appel final à `render()` :

```ts
  // Barre de lecture (⏮ ⏪ ▶/⏸ ⏩ ⏭ + compteur), miroir de Histogram.astro.
  const controls = el.querySelector<HTMLElement>('.hs-controls')!;
  const slider   = el.querySelector<HTMLInputElement>('.hs-slider')!;
  const datalist = el.querySelector<HTMLDataListElement>('.hs-datalist')!;
  const label    = el.querySelector<HTMLElement>('.hs-label')!;
  const playBtn  = el.querySelector<HTMLButtonElement>('.hs-play')!;
  const firstBtn = el.querySelector<HTMLButtonElement>('.hs-first')!;
  const prevBtn  = el.querySelector<HTMLButtonElement>('.hs-prev')!;
  const nextBtn  = el.querySelector<HTMLButtonElement>('.hs-next')!;
  const lastBtn  = el.querySelector<HTMLButtonElement>('.hs-last')!;
  let animTimer: ReturnType<typeof setInterval> | null = null;

  function stopAnim() {
    if (animTimer) { clearInterval(animTimer); animTimer = null; playBtn.textContent = '▶'; }
  }
  function goTo(pos: number) {
    currentStep = Math.max(0, Math.min(pos, S - 1));
    label.textContent = `${currentStep + 1}/${S}`;
    slider.value = String(currentStep);
    render();
  }

  if (S > 1) {
    controls.style.display = 'flex';
    slider.max = String(S - 1);
    const listId = 'hs-dl-' + Math.random().toString(36).slice(2);
    datalist.id = listId; slider.setAttribute('list', listId);
    for (let i = 0; i < S; i++) { const o = document.createElement('option'); o.value = String(i); datalist.appendChild(o); }
    label.textContent = `1/${S}`;
    slider.addEventListener('input', () => { stopAnim(); goTo(parseInt(slider.value)); });
    firstBtn.addEventListener('click', () => { stopAnim(); goTo(0); });
    prevBtn.addEventListener('click',  () => { stopAnim(); goTo(currentStep - 1); });
    nextBtn.addEventListener('click',  () => { stopAnim(); goTo(currentStep + 1); });
    lastBtn.addEventListener('click',  () => { stopAnim(); goTo(S - 1); });
    playBtn.addEventListener('click', () => {
      if (animTimer) { stopAnim(); }
      else { playBtn.textContent = '⏸'; animTimer = setInterval(() => goTo((currentStep + 1) % S), 200); }
    });
  }
```

Attention : `stopAnim` est référencée par le sélecteur de composante de l'étape 2, qui est déclaré plus haut dans le fichier. C'est licite — les déclarations `function` sont hissées et le gestionnaire ne s'exécute qu'au clic.

- [ ] **Step 4 : Construire et vérifier**

Run: `npm run build` puis `npm run preview`, ouvrir `http://localhost:4321/verif-histogram-seuils/` avec `claude-in-chrome`.

Attendu, capture à l'appui à chaque point :
1. Barre de contrôles visible en bas, compteur `1/50`.
2. Clic sur ⏭ : compteur `50/50`, les hauteurs de barres changent, l'axe y reste gradué 0–100 % (il ne se recalibre pas).
3. Six boutons de composante en haut à droite, `ε_xx` … `ε_vm` rendus en KaTeX ; clic sur `ε_vm` : le bouton passe en bleu, les barres changent.
4. Survol d'une barre : bulle avec le nom du jeu, l'intervalle et le pourcentage ; le pourcentage lu correspond à la hauteur.
5. Survol du creux entre deux groupes, et au-dessus du sommet d'une barre : aucune bulle.

- [ ] **Step 5 : Commit**

```bash
git add src/scripts/histogram-seuils-runtime.ts
git commit -m "feat(histogram-seuils): slider d'instant, sélecteur de composante et survol"
```

---

### Task 5 : Nettoyage et registres

**Files:**
- Delete: `src/pages/verif-histogram-seuils.astro`
- Modify: `.claude/memory/decisions.md`, `.claude/memory/learnings.md`, `.claude/memory/journal.md` (à la racine `/Users/thibault/Documents/THESE/Web/`)

**Interfaces:**
- Consumes: le travail des tâches 1 à 4.
- Produces: rien.

- [ ] **Step 1 : Vérifier une dernière fois l'ensemble**

Run: `node scripts/verify-histogram-seuils.mjs && npm run build`
Expected: script OK, build vert.

- [ ] **Step 2 : Supprimer la page temporaire**

```bash
git rm src/pages/verif-histogram-seuils.astro
npm run build
```

Expected: build vert, la route `verif-histogram-seuils` a disparu des pages générées. La figure JSON reste en place : il suffira d'un bloc ` ```figure ` dans un chapitre pour lui donner sa route — c'est un geste de contenu, laissé à l'utilisateur.

- [ ] **Step 3 : Écrire les registres**

Ajouter à `.claude/memory/decisions.md` une entrée **BDR-027** : nouveau type de figure « histogramme à 3 intervalles », clé `histogram_seuils`, seuils globaux nommés `seuil_bas`/`seuil_haut` pour coller au mode `threshold` des champs ([BDR-020]), axe catégoriel à trois bandes égales plutôt qu'axe de valeurs (les intervalles extérieurs n'ont pas de largeur définie), normalisation par jeu, palette catégorielle validée, hachures par jeu. Alternatives écartées : mode du composant `Histogram` existant, extraction préalable d'un socle commun, `min`/`max` comme noms de champs (collision avec `vmin`/`vmax`).

Ajouter à `.claude/memory/learnings.md` deux entrées :
- Les accents Catppuccin Mocha échouent le validateur de palette dataviz en aplat sur fond `#1e1e2e` (trop clairs, deux sous le plancher de chroma) : ils sont calibrés pour du texte, pas pour des surfaces. Garder les teintes, redescendre L et C dans la bande du mode sombre.
- Node 26 importe directement les `.ts` : un script de vérification peut consommer le vrai module (`import … from '../src/scripts/histogram-math.ts'`) au lieu d'en répliquer le code comme le fait `verify-threshold-lut.mjs`, qui n'a cette contrainte que par sa dépendance à vtk.js.

Ajouter une entrée de session à `.claude/memory/journal.md` (3-5 lignes).

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "chore(histogram-seuils): retrait de la page de vérification + registres"
```

- [ ] **Step 5 : Remettre la branche à l'utilisateur**

Ne pas fusionner, ne pas pousser. Annoncer : branche `feat/histogram-seuils` prête, N commits, `main` inchangé — la fusion fast-forward et le push lui appartiennent.

---

## Auto-revue

**Couverture de la spec.** Schéma JSON → Tâche 2, étapes 1 et 3 (tous les champs du tableau de la spec sont lus : `histogram_seuils`, `seuil_bas`, `seuil_haut`, `datasets` avec `data`/`name`/`color`/`hatch`, `fields_config`, `y_label`, `x_labels`). Convention de bornes → Tâche 1. Normalisation par jeu et exclusion des NaN → Tâche 1. Nombre de points différent autorisé → aucune vérification ne le refuse (seul le nombre d'instants est contrôlé, Tâche 2 étape 1). Axe catégoriel et axe y fixe → Tâche 2. Palette et refus au-delà de six jeux → Tâche 2. Hachures et légende → Tâche 3. Géométrie (2 px entre barres, creux d'un demi-pas, bordure 1 px) → Tâche 2, hook `draw`. Survol → Tâche 4. Contrôles et sélecteur de composante → Tâche 4. Les cinq cas d'erreur du tableau de la spec → Tâche 2, étape 1. Cas dégradé « jeu entièrement NaN » → `[0,0,0]` en Tâche 1, grisé en légende en Tâche 3. Vérification Node (cinq familles de cas) → Tâche 1. Vérification headless → Tâches 2, 3 et 4. Figure de démonstration → Tâche 2. Détection dans la route → Tâche 2.

**Placeholders.** Aucun « TODO », aucun « gérer les cas limites » : chaque étape porte son code ou sa commande, et les cinq messages d'erreur sont écrits en toutes lettres.

**Cohérence des types.** `thresholdCounts` renvoie `[number, number, number]` en Tâche 1 et `fractions` est typé `[number, number, number][]` en Tâche 2. `hatchPattern(ctx)` est défini en Tâche 3 et appelé au même endroit dans le hook `draw` et dans la légende. `dimLegend()` est défini en Tâche 3 et appelé dans `render()` de la même tâche. `stopAnim()` est défini en Tâche 4 étape 3 et référencé en Tâche 4 étape 2 — hissage de déclaration de fonction, noté dans le plan. `groupFill` est calculée une fois par figure dans `initHistogramSeuils` (Tâche 2, valeur `N/(N+1)`), lue par le hook `draw` et par le test d'appartenance du survol (Tâche 4) : les deux géométries ne peuvent pas diverger.
