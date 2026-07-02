// src/scripts/histogram-math.ts
// Math pure de l'histogramme (bins log/linéaire + comptage normalisé).
// Aucun import runtime → testable directement en Node. Partage `levelValue`
// avec l'échelle log des champs (source unique du logspace/linspace).
import { levelValue } from './scale.ts';

// bins+1 edges entre vmin et vmax ; logspace si log, linspace sinon.
export function binEdges(vmin: number, vmax: number, bins: number, log: boolean): number[] {
  const e: number[] = [];
  for (let i = 0; i <= bins; i++) e.push(levelValue(vmin, vmax, i / bins, log));
  return e;
}

// Histogramme normalisé (fréquence relative). Réplique np.histogram :
// bin i si edges[i] <= v < edges[i+1] ; dernier bin fermé à droite ;
// NaN / hors [edges[0], edges[n]] ignorés ; counts /= somme (0 si vide).
export function histogramCounts(values: ArrayLike<number>, edges: number[]): { counts: number[] } {
  const n = edges.length - 1;
  const counts = new Array(n).fill(0);
  for (let k = 0; k < values.length; k++) {
    const v = values[k];
    if (!isFinite(v) || v < edges[0] || v > edges[n]) continue;
    let lo = 0, hi = n - 1, bin = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (v < edges[mid + 1]) { bin = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    if (v === edges[n]) bin = n - 1;
    counts[bin]++;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  if (total > 0) for (let i = 0; i < n; i++) counts[i] /= total;
  return { counts };
}
