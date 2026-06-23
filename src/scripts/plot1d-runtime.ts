// src/scripts/plot1d-runtime.ts
// Runtime des figures « courbes 1D » (Plot1D) : lit une config JSON + données .npy,
// aligne les séries sur un axe x commun, et rend un graphique uPlot thémé Catppuccin.
import uPlot from 'uplot';
import { fetchNpy, type NpyArray } from './vtk-core';

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
const PALETTE = ['#89b4fa', '#fab387', '#a6e3a1', '#f38ba8', '#cba6f7', '#94e2d5', '#f9e2af', '#74c7ec'];

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

async function loadAxis(spec: string | number[] | undefined, index: number): Promise<number[] | null> {
  if (spec == null) return null;
  if (Array.isArray(spec)) return spec.map(Number);
  const npy = await fetchNpy(spec);
  return extractColumn(npy, npy.shape.length >= 2 ? index : 0);
}

export async function initPlot1D(el: HTMLElement): Promise<void> {
  const src = el.dataset.src!;
  const cfg = await fetch(src).then(r => {
    if (!r.ok) throw new Error(`Config introuvable : ${src} (${r.status})`);
    return r.json() as Promise<Plot1DConfig>;
  });
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

  const host = el.querySelector<HTMLElement>('.plot1d-host')!;
  const size = () => ({ width: host.clientWidth, height: host.clientHeight });
  const axisStroke = '#cdd6f4', gridStroke = '#313244', tickStroke = '#45475a';
  const opts: uPlot.Options = {
    title: cfg.title,
    ...size(),
    scales: {
      x: { time: false, distr: (cfg.xlog ? 3 : 1) as 1 | 3 },
      y: { distr: (cfg.ylog ? 3 : 1) as 1 | 3 },
    },
    axes: [
      { label: cfg.xlabel, stroke: axisStroke, grid: { stroke: gridStroke }, ticks: { stroke: tickStroke }, font: '11px monospace', labelFont: '12px monospace' },
      { label: cfg.ylabel, stroke: axisStroke, grid: { stroke: gridStroke }, ticks: { stroke: tickStroke }, font: '11px monospace', labelFont: '12px monospace' },
    ],
    series: [
      {},
      ...loaded.map(s => ({ label: s.label, stroke: s.color, width: s.width, dash: s.dash, spanGaps: true, points: { show: false } })),
    ],
    cursor: { drag: { x: true, y: false } },
    legend: { show: cfg.legend !== false },
  };

  const u = new uPlot(opts, data, host);
  new ResizeObserver(() => u.setSize(size())).observe(host);
  el.querySelector<HTMLElement>('.plot1d-loading')!.style.display = 'none';
}
