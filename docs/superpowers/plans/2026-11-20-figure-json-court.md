# Format court des JSON de figure — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** permettre `dossier`, `image_pas` et `steps: N` dans les JSON de figure, résolus par une seule fonction partagée, puis convertir les 14 JSON existants.

**Architecture :** module pur `src/scripts/figure-config.ts` (aucun import) : `normalizeFigureConfig` rend une config à l'ancien format ; `loadFigureConfig` = fetch + normalisation, appelé par les 7 chargeurs actuels. Conversion des JSON par un script ponctuel avec garde-fou d'égalité.

**Tech Stack :** TypeScript, Astro 5, Node 26 (import direct du `.ts` dans les scripts de vérification).

**Spec :** `docs/superpowers/specs/2026-11-20-figure-json-court-design.md`

## Global Constraints

- Aucune nouvelle dépendance.
- Clés de chemin : `coords`, `triangles`, `triangulation`, `connectivity`, `fields`, `displacements`, `images`, `image`, `data`, `x`, `y` — valeurs chaînes seulement, à toute profondeur.
- Inchangés : chaînes commençant par `/`, `http://`, `https://`, `data:`.
- Jetons de `image_pas` : `{pas}` et `{pas+1}` exactement.
- `dossier` et `image_pas` absents du résultat normalisé ; l'objet d'entrée n'est jamais modifié.
- Messages d'erreur en français, nommant la clé fautive.
- Git : l'agent ne commite pas ; l'auteur commite. La conversion des JSON est un commit séparé du code.
- Conversion : ne jamais réécrire un JSON ayant des modifications non commitées.

## Review Focus

1. **JSON à l'ancien format (chemins absolus partout)** → rendu identique. Test `ancien format inchangé` sur les 14 fichiers actuels (Task 1, avant conversion).
2. **`steps` en liste avec `text` + `image_pas`** → chaque pas reçoit son image, `text` intact. Test `liste avec text + image_pas` (Task 1).
3. **Chemin `x` de Plot1D donné en tableau de nombres** → non touché. Test `tableau x intact` (Task 1).
4. **Panneau de comparaison avec `dossier` relatif** → joint au dossier du parent. Test `dossier imbriqué relatif` (Task 1).
5. **Fichier en cours d'édition par l'auteur au moment de la conversion** → non réécrit, signalé. Step 1 de la Task 3.

---

### Task 1 : module `figure-config.ts` et vérification

**Files :**
- Create : `src/scripts/figure-config.ts`
- Create : `scripts/verify-figure-config.mjs`

**Interfaces :**
- Produces :
  ```ts
  export class FigureConfigError extends Error {}
  export function normalizeFigureConfig(cfg: unknown): any;     // lève FigureConfigError
  export async function loadFigureConfig(url: string): Promise<any>;
  // loadFigureConfig : `Config introuvable : ${url} (${status})` si !r.ok, puis normalizeFigureConfig(json)
  ```

- [ ] **Step 1 : écrire `scripts/verify-figure-config.mjs`** (style de `verify-histogram-seuils.mjs`, `assert` de `node:assert/strict`, sortie PASS/FAIL, exit 1 si échec). Cas, avec `D = '/data/a'` :
  - `jointure` : `{dossier:D, coords:'c.npy'}` → `{coords:'/data/a/c.npy'}` ; `dossier:'/data/a/'` (slash final) donne le même résultat.
  - `absolu, http, data: inchangés`.
  - `dossier imbriqué remplace` : `{dossier:D, panels:[{dossier:'/data/b', fields:'f.npy'}, {fields:'g.npy'}]}` → `/data/b/f.npy`, `/data/a/g.npy`.
  - `dossier imbriqué relatif` : panneau `dossier:'p1'` → `/data/a/p1/f.npy`.
  - `clés non-chemin intactes` : `text`, `name`, `title` relatifs non modifiés.
  - `tableau x intact` : `{dossier:D, x:[1,2,3], curves:[{y:'y.npy'}]}` → `x` identique, `y` résolu.
  - `steps numérique` : `{steps:3}` → `[{step:0},{step:1},{step:2}]`.
  - `image_pas {pas+1}` : `{dossier:D, image_pas:'s_{pas+1}.png', steps:2}` → images `/data/a/s_1.png`, `/data/a/s_2.png`.
  - `image_pas {pas}` et `image_pas fixe` (`'s_0.png'` → même image pour tous).
  - `image propre prioritaire` : un pas avec `image:'x.png'` garde `/data/a/x.png`.
  - `liste avec text + image_pas` : `steps:[{step:0,text:{"0":"t"}}]` → `text` intact, image ajoutée.
  - `clés retirées` : ni `dossier` ni `image_pas` dans le résultat.
  - `entrée non modifiée` : `JSON.stringify(entrée)` identique avant/après.
  - erreurs (`assert.throws`, message citant la clé) : `relatif sans dossier` (cite `coords`), `dossier racine relatif` (cite `dossier`), `steps: 0`, `steps: 2.5`, `image_pas sans steps`, `image_pas avec images` (cite `images`).
  - `ancien format inchangé` : pour chaque `public/figures/manuscrit/*.json` sans clé `dossier`, `assert.deepEqual(normalizeFigureConfig(json), json)`.
  - `aucun chemin relatif` : pour chaque JSON, après normalisation, toute valeur chaîne d'une clé de chemin commence par `/`, `http` ou `data:`.

- [ ] **Step 2 :** `node scripts/verify-figure-config.mjs` — attendu : échec à l'import (module absent).

- [ ] **Step 3 : implémenter `figure-config.ts`.** Ordre (spec) : `steps` numérique → liste ; `image_pas` → `image` des pas sans image ; résolution récursive des chemins avec héritage de `dossier` ; suppression de `dossier`/`image_pas`. Copie profonde, pas de mutation.

- [ ] **Step 4 :** `node scripts/verify-figure-config.mjs` — attendu : tous PASS, exit 0.

---

### Task 2 : brancher les 7 chargeurs

**Files (modify) :** `src/components/VtkFigure.astro` (l. ~371), `src/components/VtkFigure3D.astro` (l. ~255), `src/scripts/vtk-compare-runtime.ts` (l. ~62), `src/scripts/field-curve-runtime.ts` (l. ~30), `src/scripts/plot1d-runtime.ts` (l. ~91), `src/scripts/histogram-runtime.ts` (l. ~25), `src/scripts/histogram-seuils-runtime.ts` (l. ~80).

**Interfaces :** Consumes `loadFigureConfig` (Task 1).

- [ ] **Step 1 :** remplacer chaque `fetch(<src>).then(r => …json())` du **JSON de configuration** par `await loadFigureConfig(<src>)` (garder les types annotés existants, ex. `as Plot1DConfig`). Ne pas toucher aux `fetch` des `.npy`.
- [ ] **Step 2 :** `grep -n "\.json()" src/components/VtkFigure*.astro src/scripts/*-runtime.ts` — attendu : aucune occurrence.
- [ ] **Step 3 :** `node scripts/verify-figure-config.mjs && npm run build` — attendu : PASS, build exit 0 ; `node_modules/.bin/tsc --noEmit -p .` — attendu : pas d'erreur nouvelle (4 préexistantes : astro.config, vtk-core ×2, field-curve-runtime `getValue`).
- [ ] **Step 4 : point de commit (code)** : `feat: dossier commun et modèle d'image dans les JSON de figure`.

---

### Task 3 : conversion des 14 JSON + documentation

**Files :**
- Modify : `public/figures/manuscrit/*.json` (14 fichiers)
- Modify : `src/components/VtkFigure.astro` (commentaire de schéma l. 5-38)
- Script ponctuel dans le scratchpad (non commité).

- [ ] **Step 1 : garde-fou** — `git status --porcelain public/figures/manuscrit` ; tout fichier listé est exclu de la conversion et signalé à l'auteur.
- [ ] **Step 2 : script de conversion** (Node, importe `normalizeFigureConfig`) par fichier : dossier commun de tous les chemins de clés de chemin → `dossier` en première clé ; chemins raccourcis ; si les `image` des pas suivent toutes `{pas+1}`, `{pas}` ou sont identiques → `image_pas` et suppression des `image` de pas ; si les pas ne contiennent plus que `step` consécutif depuis 0 → `steps: N`. Écrire seulement si `deepEqual(normalizeFigureConfig(nouveau), ancien)` ; sinon signaler. Indentation 4 espaces, caractères non ASCII conservés tels quels.
- [ ] **Step 3 :** `node scripts/verify-figure-config.mjs` — attendu : PASS ; `wc -l public/figures/manuscrit/*.json` avant/après rapporté à l'auteur.
- [ ] **Step 4 : documentation** — dans le commentaire de schéma de `VtkFigure.astro`, ajouter `dossier`, `image_pas`, `steps: N` avec un exemple de 5 lignes.
- [ ] **Step 5 : vérifier** — `npm run build` ; dans le navigateur (dev server `--force`) : figure 4.5 (fond d'image animé), comparaison 4.11, un histogramme : rendu identique, aucune erreur console.
- [ ] **Step 6 : point de commit (données)** : `chore: JSON de figure au format court`.
