// src/scripts/scale.ts
// Source UNIQUE de la mathématique d'échelle (linéaire/log) partagée par tous
// les viewers de champs. Fichier PUR (aucun import) → testable directement en
// Node (type-stripping natif), contrairement à vtk-core.ts (imports @kitware).

// Valeur à la fraction normalisée frac ∈ [0,1] (0 → vmin, 1 → vmax).
// log=true → espacement géométrique (= np.logspace / LogNorm) ; exige vmin > 0.
export function levelValue(vmin: number, vmax: number, frac: number, log: boolean): number {
  return log
    ? vmin * Math.pow(vmax / vmin, frac)
    : vmin + (vmax - vmin) * frac;
}
