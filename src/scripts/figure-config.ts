// Chargement et normalisation des JSON de figure (spec :
// docs/superpowers/specs/2026-11-20-figure-json-court-design.md).
// Le format court (`dossier`, `image_pas`, `steps: N`) est ramené à l'ancien
// format : chemins absolus, `steps` en liste, `image` dans chaque pas.
// Aucun import : testé par scripts/verify-figure-config.mjs.

export class FigureConfigError extends Error {}

const PATH_KEYS = new Set(['coords', 'triangles', 'triangulation', 'connectivity', 'fields',
  'displacements', 'images', 'image', 'data', 'x', 'y']);
const ABSOLUTE = /^(\/|https?:\/\/|data:)/;

const fail = (msg: string): never => { throw new FigureConfigError(`Config de figure : ${msg}`); };
const join = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

function expandSteps(steps: unknown): unknown {
  if (typeof steps !== 'number') return steps;
  if (!Number.isInteger(steps) || steps < 1) fail(`« steps » doit être un entier ≥ 1 ou une liste (reçu ${steps}).`);
  return Array.from({ length: steps }, (_, i) => ({ step: i }));
}

function applyImageTemplate(cfg: Record<string, any>): void {
  const tpl = cfg.image_pas;
  if (tpl === undefined) return;
  if (typeof tpl !== 'string' || tpl === '') fail('« image_pas » doit être un nom de fichier.');
  if (!Array.isArray(cfg.steps)) fail('« image_pas » demande « steps » (nombre de pas ou liste).');
  const panelImages = Array.isArray(cfg.panels) && cfg.panels.some((p: any) => p && p.images !== undefined);
  if (cfg.images !== undefined || panelImages) fail('« image_pas » et « images » (pile .npy) ne peuvent pas être combinés.');
  cfg.steps = cfg.steps.map((st: Record<string, any>) => {
    if (st.image !== undefined) return st;
    const n = Number(st.step);
    return { ...st, image: tpl.replaceAll('{pas+1}', String(n + 1)).replaceAll('{pas}', String(n)) };
  });
}

/** Résout les chemins relatifs par `dossier` (hérité du parent), retire `dossier`. */
function resolvePaths(node: unknown, parentDir: string | null, isRoot: boolean): unknown {
  if (Array.isArray(node)) return node.map(v => resolvePaths(v, parentDir, false));
  if (!node || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  let dir = parentDir;
  if (obj.dossier !== undefined) {
    const d = obj.dossier;
    if (typeof d !== 'string' || d === '') fail('« dossier » doit être un chemin.');
    else if (ABSOLUTE.test(d)) dir = d;
    else if (isRoot || !parentDir) fail(`« dossier » doit commencer par « / » (reçu « ${d} »).`);
    else dir = join(parentDir, d);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'dossier') continue;
    if (PATH_KEYS.has(k) && typeof v === 'string' && !ABSOLUTE.test(v)) {
      if (!dir) fail(`chemin relatif « ${v} » pour la clé « ${k} » sans « dossier ».`);
      out[k] = join(dir as string, v);
    } else {
      out[k] = resolvePaths(v, dir, false);
    }
  }
  return out;
}

/** Renvoie une NOUVELLE config à l'ancien format ; lève FigureConfigError. */
export function normalizeFigureConfig(cfg: unknown): any {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) fail('le JSON doit être un objet.');
  const top: Record<string, any> = { ...(cfg as Record<string, any>) };
  if ('steps' in top) top.steps = expandSteps(top.steps);
  applyImageTemplate(top);
  delete top.image_pas;
  return resolvePaths(top, null, true);
}

export async function loadFigureConfig(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new FigureConfigError(`Config introuvable : ${url} (${r.status})`);
  return normalizeFigureConfig(await r.json());
}
