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

  // Le creux entre deux groupes vaut toujours la largeur d'une barre : la part
  // du pas occupée par un groupe est N/(N+1). Un seul jeu → 0,5 (le demi-pas de
  // la spec) ; six jeux → 0,857, le creux ne se referme jamais.
  const groupFill = loaded.length / (loaded.length + 1);

  // ── Étiquettes ───────────────────────────────────────────────────────────
  const yLabel: string = cfg.y_label ?? '\\text{Fraction de points}';
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
              if (loaded[d].hatch) {
                const p = hatchPattern(ctx);
                if (p) { ctx.fillStyle = p; ctx.fillRect(x, yT, w, y0 - yT); }
              }
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
    dimLegend();
    if (!u) buildPlot(); else u.redraw();
  }

  new ResizeObserver(() => { if (u) u.setSize({ width: mount.clientWidth, height: mount.clientHeight }); }).observe(mount);

  render();
}
