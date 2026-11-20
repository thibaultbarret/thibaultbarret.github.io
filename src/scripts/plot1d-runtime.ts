// src/scripts/plot1d-runtime.ts
// Runtime des figures « courbes 1D » (Plot1D) : lit une config JSON + données .npy,
// aligne les séries sur un axe x commun, et rend un graphique uPlot thémé Catppuccin.
import uPlot from 'uplot';
import { fetchNpy, type NpyArray } from './vtk-core';
import { loadFigureConfig } from './figure-config';
import katex from 'katex';
import katexMacros from '../katex-macros.js';

export interface CurveConfig {
  y: string;                 // path .npy (1D, ou 2D (N,K) avec `index`)
  x?: string | number[];     // path .npy / tableau inline ; écrase le x racine
  label?: string;
  color?: string;
  width?: number;
  dash?: number[];
  index?: number;            // colonne si .npy 2D (défaut 0)
}
export interface Plot1DConfig {
  title?: string;
  xlabel?: string;
  ylabel?: string;
  x?: string | number[];     // axe x partagé
  xlog?: boolean;
  ylog?: boolean;
  legend?: boolean;
  curves: CurveConfig[];
}

// Palette Catppuccin Mocha (cyclée si `color` absent)
export const PALETTE = ['#89b4fa', '#fab387', '#a6e3a1', '#f38ba8', '#cba6f7', '#94e2d5', '#f9e2af', '#74c7ec'];

const toNull = (v: number): number | null => (Number.isFinite(v) ? v : null);

// Extrait une colonne d'un NpyArray : 1D → tout le tableau ; 2D (N,K) → colonne `col`.
export function extractColumn(npy: NpyArray, col: number): number[] {
  const { data, shape } = npy;
  if (shape.length <= 1) return Array.from(data as ArrayLike<number>, Number);
  const N = shape[0], K = shape[1];
  const c = Math.max(0, Math.min(col, K - 1));
  const out = new Array<number>(N);
  for (let i = 0; i < N; i++) out[i] = Number(data[i * K + c]);
  return out;
}

// Aligne des séries (chacune {x, y} de même longueur) sur l'union triée et dédoublonnée des x.
// Retourne les données uPlot : [xs, y1, y2, …] avec null là où une série n'a pas de point.
// Les valeurs x non finies sont ignorées ; les y non finis deviennent null.
export function alignSeries(series: { x: number[]; y: number[] }[]): (number | null)[][] {
  const xset = new Set<number>();
  for (const s of series) for (const xv of s.x) if (Number.isFinite(xv)) xset.add(xv);
  const xs = Array.from(xset).sort((a, b) => a - b);
  const pos = new Map<number, number>();
  xs.forEach((xv, i) => pos.set(xv, i));
  const out: (number | null)[][] = [xs];
  for (const s of series) {
    const col = new Array<number | null>(xs.length).fill(null);
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i];
      if (!Number.isFinite(xv)) continue;
      col[pos.get(xv)!] = toNull(s.y[i]);
    }
    out.push(col);
  }
  return out;
}

export async function loadAxis(spec: string | number[] | undefined, index: number): Promise<number[] | null> {
  if (spec == null) return null;
  if (Array.isArray(spec)) return spec.map(Number);
  const npy = await fetchNpy(spec);
  return extractColumn(npy, npy.shape.length >= 2 ? index : 0);
}

// Rend `src` (LaTeX) en HTML KaTeX dans `el`. Pour l'axe y, `el` est le span pivoté
// et on masque/affiche sa cellule parente. Repli texte brut si KaTeX échoue.
export function renderTex(el: HTMLElement | null, src: string | undefined, isYAxis: boolean): void {
  if (!el) return;
  const cell = isYAxis ? (el.parentElement as HTMLElement | null) : el;
  if (!cell) return;
  if (!src) { cell.style.display = 'none'; return; }
  cell.style.display = isYAxis ? 'block' : '';
  try {
    el.innerHTML = katex.renderToString(src, { macros: katexMacros as Record<string, string>, throwOnError: false });
  } catch {
    el.textContent = src;
  }
}

export async function initPlot1D(el: HTMLElement): Promise<void> {
  const src = el.dataset.src!;
  const cfg = await loadFigureConfig(src) as Plot1DConfig;
  if (!Array.isArray(cfg.curves) || cfg.curves.length === 0)
    throw new Error('Aucune courbe : le champ `curves` est vide ou absent.');

  const loaded = await Promise.all(cfg.curves.map(async (c, i) => {
    const label = c.label ?? `Série ${i + 1}`;
    const index = c.index ?? 0;
    const yNpy = await fetchNpy(c.y);
    const y = extractColumn(yNpy, yNpy.shape.length >= 2 ? index : 0);
    const x = await loadAxis(c.x ?? cfg.x, index);
    if (x == null) throw new Error(`Courbe « ${label} » : aucun axe x (ni propre, ni racine).`);
    if (x.length !== y.length)
      throw new Error(`Courbe « ${label} » : x (${x.length}) et y (${y.length}) de longueurs différentes.`);
    return { x, y, label, color: c.color ?? PALETTE[i % PALETTE.length], width: c.width ?? 2, dash: c.dash };
  }));

  const data = alignSeries(loaded.map(s => ({ x: s.x, y: s.y }))) as uPlot.AlignedData;

  // Labels LaTeX rendus en HTML KaTeX (titre, axe x, axe y pivoté)
  renderTex(el.querySelector<HTMLElement>('.plot1d-title'), cfg.title, false);
  renderTex(el.querySelector<HTMLElement>('.plot1d-xlabel'), cfg.xlabel, false);
  renderTex(el.querySelector<HTMLElement>('.plot1d-ylabel-inner'), cfg.ylabel, true);

  const mount = el.querySelector<HTMLElement>('.plot1d-uplot')!;
  // La légende uPlot est rendue SOUS le canvas dans le même conteneur : on retire
  // sa hauteur pour que canvas + légende tiennent dans la cellule (sinon la légende
  // déborde sur l'axe x / le label x).
  const legendH = () => mount.querySelector<HTMLElement>('.u-legend')?.offsetHeight ?? 0;
  const size = () => ({ width: mount.clientWidth, height: Math.max(80, mount.clientHeight - legendH()) });
  const axisStroke = '#cdd6f4', gridStroke = '#313244', tickStroke = '#45475a';
  // Marqueur optionnel piloté de l'extérieur (FieldCurve) via `__plot1d.setMarker`.
  // Caché par défaut (markerIdx < 0) → le Plot1D autonome est inchangé.
  let markerIdx = -1;
  const markerColor: string = (cfg as any).marker_color ?? '#f38ba8';
  const markerSize: number = (cfg as any).marker_size ?? 7;
  const opts: uPlot.Options = {
    ...size(),
    scales: {
      x: { time: false, distr: (cfg.xlog ? 3 : 1) as 1 | 3 },
      y: { distr: (cfg.ylog ? 3 : 1) as 1 | 3 },
    },
    axes: [
      { stroke: axisStroke, grid: { stroke: gridStroke }, ticks: { stroke: tickStroke }, font: '11px monospace' },
      { stroke: axisStroke, grid: { stroke: gridStroke }, ticks: { stroke: tickStroke }, font: '11px monospace' },
    ],
    series: [
      {},
      ...loaded.map(s => ({ label: s.label, stroke: s.color, width: s.width, dash: s.dash, spanGaps: true, points: { show: false } })),
    ],
    cursor: { drag: { x: true, y: false } },
    legend: { show: cfg.legend !== false },
    hooks: {
      draw: [ (u: any) => {
        if (markerIdx < 0) return;
        const ctx = u.ctx; ctx.save();
        for (const s of loaded) {
          const k = Math.max(0, Math.min(markerIdx, s.x.length - 1));
          const xv = s.x[k], yv = s.y[k];
          if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
          const cx = u.valToPos(xv, 'x', true), cy = u.valToPos(yv, 'y', true);
          ctx.beginPath(); ctx.arc(cx, cy, markerSize, 0, 2 * Math.PI);
          ctx.fillStyle = markerColor; ctx.strokeStyle = '#1e1e2e'; ctx.lineWidth = 2;
          ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      } ],
    },
  };

  const u = new uPlot(opts, data, mount);
  // API externe : FieldCurve pilote le marqueur de la courbe via cette poignée.
  (el as any).__plot1d = { setMarker(i: number) { markerIdx = i; u.redraw(); } };

  // Légende : noms de séries en LaTeX (best-effort ; row 0 = axe x ; repli texte brut)
  if (cfg.legend !== false) {
    const rows = mount.querySelectorAll<HTMLElement>('.u-legend .u-series');
    loaded.forEach((s, i) => {
      const row = rows[i + 1];
      const cell = row?.querySelector<HTMLElement>('.u-label') ?? (row?.lastElementChild as HTMLElement | null);
      if (cell) renderTex(cell, s.label, false);
    });
  }

  // La légende (et son rendu KaTeX) existe maintenant : on redimensionne le canvas
  // pour qu'elle tienne dans la cellule sans chevaucher l'axe x.
  u.setSize(size());

  new ResizeObserver(() => u.setSize(size())).observe(mount);
  el.querySelector<HTMLElement>('.plot1d-loading')!.style.display = 'none';
}
