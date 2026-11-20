# Lecteur commun des figures de champ (VtkPlayer) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer les contrôles des quatre figures de champ par une barre commune (cadre encastré, menu de composante, lecture cadencée, « dernier demandé gagne ») et limiter le dé-zoom à 2 × la vue de référence.

**Architecture :** la logique pure (ordonnanceur, cadence, bornage du zoom) vit dans `player-core.ts`, sans import, testée par un script Node. Le DOM de la barre est un composant Astro (`VtkPlayerBar.astro`) piloté par `vtk-player.ts`. Le bornage caméra est un utilitaire de `vtk-core.ts`. Les quatre composants de figure sont migrés un par un.

**Tech Stack :** Astro 5, TypeScript, vtk.js 36, uPlot (inchangé), Node 26 (import direct de `.ts` dans les scripts de vérification).

**Spec :** `docs/superpowers/specs/2026-11-20-vtk-player-design.md`

## Global Constraints

- Aucune nouvelle dépendance.
- Palette : crust `#11111b`, mantle `#181825`, base `#1e1e2e`, surface0 `#313244`, surface1 `#45475a`, subtext `#a6adc8`, text `#cdd6f4`, accent `#89b4fa`.
- Cadre : fond `#11111b`, rayon 8 px, bordure 1 px `#45475a`, `box-shadow: inset 0 0 0 1px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.35)`.
- Barre sous le cadre, marge haute 10 px, ordre : menu · ⏮ ‹ ▶ › ⏭ · slider · compteur `n / N` · boutons de vue.
- Boutons 32 px transparents, survol `#313244`, focus visible 2 px `#89b4fa` ; lecture : rond 36 px fond accent, icône `#11111b`.
- Icônes SVG au trait, 16 px, `stroke-width: 1.8`, `stroke-linecap/linejoin: round` (tracés de la maquette `.superpowers/brainstorm/24028-1795165989/content/vtk-controls-style.html`, symboles `i-first … i-reset`).
- Slider : piste 4 px, parcouru accent via `--p`, pouce 14 px `#cdd6f4` bordé 3 px accent (WebKit **et** `::-moz-range-thumb`).
- `FRAME_MS = 200`, `MAX_ZOOM_OUT = 2`.
- Aucun contrôle interactif dans un conteneur passé à `setContainer`.
- `aria-label` en français sur chaque bouton, le slider et le menu.
- `height` garde son sens actuel par composant (cadre en 2D/3D, figure entière en champ+courbe et comparaison).
- **Git :** l'agent ne commite pas et ne pousse pas ; chaque tâche se termine par un point de commit proposé à l'auteur, qui commite lui-même sur `main`.

## Review Focus

1. **Glissé du slider ou clic de bouton sur une figure 2D/3D** → aucun mouvement de caméra. Vérifié à la main dans chaque tâche de migration (la cause était la capture de pointeur vtk).
2. **Glissé rapide du slider d'un bout à l'autre** → l'image finale correspond à la position finale du slider. Test `dernier demandé affiché en dernier` (Tâche 1) + vérification manuelle.
3. **Changement de composante pendant la lecture** → lecture arrêtée, composante affichée au pas courant. Vérification manuelle Tâche 2.
4. **Rendu qui échoue au milieu d'un glissé** (réseau) → l'ordonnanceur continue et affiche les demandes suivantes. Test `un échec ne bloque pas` (Tâche 1).
5. **Comparaison liée + molette arrière** → tous les panneaux bornés, pas de boucle infinie de `onModified`. Test `bornage idempotent` (Tâche 1) + vérification manuelle Tâche 6.

---

### Task 1 : logique pure du lecteur et script de vérification

**Files :**
- Create : `src/scripts/player-core.ts`
- Create : `scripts/verify-vtk-player.mjs`

**Interfaces :**
- Produces :
  ```ts
  export const FRAME_MS = 200;
  export const MAX_ZOOM_OUT = 2;
  export interface RenderScheduler {
    request(step: number, field: number): Promise<void>; // résolue quand plus rien n'est en attente
    shown(): { step: number; field: number } | null;
  }
  export function createRenderScheduler(
    render: (step: number, field: number) => Promise<void>,
    initial: { step: number; field: number },          // déjà affiché par l'appelant
    onError: (err: unknown) => void,
  ): RenderScheduler;
  export function nextFrameDelay(elapsedMs: number): number;          // max(0, FRAME_MS − elapsed)
  export function clampZoomOut(value: number, reference: number): number; // min(value, MAX_ZOOM_OUT × reference)
  ```

- [ ] **Step 1 : écrire `scripts/verify-vtk-player.mjs`** dans le style de `scripts/verify-histogram-seuils.mjs` (import direct de `../src/scripts/player-core.ts`, tableau de cas, sortie `✓`/`✗`, `process.exit(1)` si un cas échoue). Cas :
  - `dernier demandé affiché en dernier` : `render` factice qui enregistre `step` dans un tableau après un délai `[50, 5, 30, 1][step] ms` ; `request(1), request(2), request(3)` sans attendre, puis `await` la dernière → le dernier élément enregistré vaut `3` et `shown()` vaut `{step:3, field:0}`.
  - `pas de rendu périmé après un plus récent` : même montage → le tableau ne contient jamais une valeur après `3` ; les demandes intermédiaires écrasées (2) peuvent être sautées.
  - `pas de rendu si déjà affiché` : `request(0,0)` avec `initial {0,0}` → `render` jamais appelé.
  - `un échec ne bloque pas` : `render` rejette pour `step === 1` ; `request(1)` puis `request(2)` → `onError` appelé une fois, `shown()` vaut `{step:2, field:0}`.
  - `nextFrameDelay` : `0 → 200`, `150 → 50`, `350 → 0`.
  - `clampZoomOut` : `(1, 1) → 1`, `(3, 1) → 2`, `(2, 1) → 2`.
  - `bornage idempotent` : `clampZoomOut(clampZoomOut(5,1),1) === clampZoomOut(5,1)`.

- [ ] **Step 2 : lancer** `node scripts/verify-vtk-player.mjs` — attendu : échec à l'import (`player-core.ts` absent).

- [ ] **Step 3 : implémenter `src/scripts/player-core.ts`**, sans aucun import. Ordonnanceur : un seul rendu à la fois ; une variable `wanted` écrasée à chaque `request` ; boucle `while (wanted ≠ shown) { snap = wanted; try { await render(snap) ; shown = snap } catch (e) { onError(e); shown = snap } }` — marquer `snap` comme traité même en échec pour ne pas boucler. Les `request` appelées pendant une boucle en cours renvoient la promesse de cette boucle.

- [ ] **Step 4 : lancer** `node scripts/verify-vtk-player.mjs` — attendu : tous les cas `✓`, code de sortie 0.

- [ ] **Step 5 : point de commit** (proposé à l'auteur) : `feat: logique pure du lecteur de figures (ordonnanceur, cadence, bornage zoom)`.

---

### Task 2 : barre commune + migration de la figure 2D

**Files :**
- Create : `src/components/VtkPlayerBar.astro`
- Create : `src/scripts/vtk-player.ts`
- Modify : `src/styles/global.css` (ajout de `.field-frame`)
- Modify : `src/components/VtkFigure.astro` (balisage l. 51-91, champs l. 594-614, lecture l. 617-664, reset l. 666-672, premier rendu l. 699)

**Interfaces :**
- Consumes : `createRenderScheduler`, `nextFrameDelay` (Task 1).
- Produces :
  - `VtkPlayerBar.astro` : aucune prop ; un `<slot />` pour les boutons de vue, rendu à droite du compteur. Classes publiques : `.vp-bar` (racine), `.vp-field` (`<select>`), `.vp-first .vp-prev .vp-play .vp-next .vp-last`, `.vp-slider`, `.vp-count`, `.vp-btn` (classe à donner aux boutons de vue passés en slot), `.vp-icon` (SVG 16 px). Styles en `<style is:global>` préfixés `.vp-`.
  - ```ts
    export function createPlayer(bar: HTMLElement, opts: {
      steps: number;
      fields: { index: number; name: string }[];
      render: (step: number, field: number) => Promise<void>;
    }): Promise<{ goTo(step: number): void; stop(): void }>;
    ```
    Fait le rendu du pas 0 / première composante **avant** de résoudre ; rejette si ce rendu échoue (le `.catch` existant affiche « Erreur VTK »).
  - `.field-frame` (global.css) : le cadre des Global Constraints, `position: relative; overflow: hidden`.

- [ ] **Step 1 : `VtkPlayerBar.astro`** — balisage dans l'ordre des Global Constraints, `flex-wrap: wrap`. Sous `@media (max-width: 480px)` : le slider passe en `flex-basis: 100%` sur une seconde ligne. Bouton lecture : deux SVG (lecture, pause), celui affiché selon `[aria-pressed]`.

- [ ] **Step 2 : `vtk-player.ts`** — remplit le `<select>` (masqué si `fields.length < 2`), masque boutons de pas, slider et compteur si `steps < 2` ; met à jour `--p`, `value` du slider et compteur `${step+1} / ${steps}` **immédiatement** à chaque demande, puis `scheduler.request`. Lecture : boucle `async` avec jeton (une seule boucle vivante) : `t0` ; `await request((step+1) % steps, field)` ; `await sleep(nextFrameDelay(now − t0))`. Les boutons de pas, le slider (`input`) et le menu (`change`) appellent `stop()` avant d'agir. Erreurs de rendu après le premier : `console.error('[VtkPlayer]', err)`.

- [ ] **Step 3 : migrer `VtkFigure.astro`** — envelopper `.vtk-canvas` dans `<div class="field-frame">` (le `height` reste sur `.vtk-canvas`) ; retirer `.vtk-controls`, `.vtk-fields`, `.vtk-reset` du `.vtk-canvas` ; placer `<VtkPlayerBar>` après le cadre, avec en slot `<button class="vp-btn vtk-reset" aria-label="Réinitialiser la vue">` (icône `i-reset`) ; ordre final cadre → barre → `.vtk-text-panel`. Remplacer le code des lignes 594-664 et l'appel `await goTo(0)` par `const player = await createPlayer(bar, { steps: steps.length, fields: fieldsConfig, render })`. `render(step, field)` met à jour `currentFieldIdx` et le panneau de texte comme le faisait le code supprimé.

- [ ] **Step 4 : vérifier** — `node scripts/verify-vtk-player.mjs` (toujours vert) et `npm run build` sans erreur. Puis `npm run dev`, ouvrir la page `/manuscrit/<chapitre>/<figure>` d'une figure 2D (JSON sans `panels`, `curves`, `dic`, `fe` ; ex. `Traction_homogene-champ_deformation_cin.json`, URL retrouvable avec `grep -rl Traction_homogene-champ_deformation_cin src/content`) et constater : glisser le slider ne bouge pas la caméra ; clics rapides sur ‹ › tous pris ; lecture fluide, s'arrête au clic sur un pas ; changer de composante pendant la lecture l'arrête et affiche la composante au pas courant ; tooltip et barre de couleur intacts ; à 375 px de large, slider sur sa propre ligne ; clavier : Tab parcourt la barre, flèches sur le slider.

- [ ] **Step 5 : point de commit** : `feat: barre de lecture commune, figure 2D migrée`.

---

### Task 3 : limite de dé-zoom (utilitaire + figure 2D)

**Files :**
- Modify : `src/scripts/vtk-core.ts` (ajout en fin de fichier)
- Modify : `src/components/VtkFigure.astro` (appels `renderer.resetCamera()` l. 585 et dans le bouton ⟳)

**Interfaces :**
- Consumes : `clampZoomOut` (Task 1).
- Produces :
  ```ts
  export function limitZoomOut(renderer: vtkRenderer, cam: vtkCamera): { reset(): void };
  ```
  `reset()` appelle `renderer.resetCamera()` puis relève la référence (`getParallelScale()` et `getDistance()`). Abonné à `cam.onModified` : en parallèle, si `getParallelScale()` dépasse la borne (tolérance relative `1e-9`), `setParallelScale(borné)` ; en perspective, si `getDistance()` dépasse la borne, `setPosition(focal − directionOfProjection × borné)` puis `renderer.resetCameraClippingRange()`. Ne modifie la caméra que si la borne est dépassée. Rien n'est borné tant que `reset()` n'a pas été appelé une fois.

- [ ] **Step 1 : implémenter `limitZoomOut`** dans `vtk-core.ts`.
- [ ] **Step 2 : brancher dans `VtkFigure.astro`** — `const zoom = limitZoomOut(renderer, cam)` après la création de la caméra ; remplacer chaque `renderer.resetCamera()` par `zoom.reset()`.
- [ ] **Step 3 : vérifier** — `npm run build` ; dans `npm run dev` sur la figure 2D de la Task 2 : molette arrière prolongée → le champ s'arrête à environ la moitié du cadre ; ⟳ puis molette arrière → même borne ; zoom avant inchangé.
- [ ] **Step 4 : point de commit** : `feat: limite de dé-zoom des figures de champ`.

---

### Task 4 : migration de la figure 3D

**Files :**
- Modify : `src/components/VtkFigure3D.astro` (balisage l. 12-56, lecture l. 482-517, premier rendu et boutons de vue l. 519-541, reset de positions l. 469)

**Interfaces :**
- Consumes : `VtkPlayerBar`, `createPlayer` (Task 2), `limitZoomOut` (Task 3).

- [ ] **Step 1 : balisage** — `.vtk3d-canvas` dans `.field-frame` ; `.vtk3d-controls`, `.vtk3d-fields`, `.vtk3d-view-btns` retirés du conteneur ; `.vtk3d-legend` reste dans le cadre (surimpression) ; slot de la barre : `.vtk3d-parallel` (`aria-label="Vue parallèle (face)"`, icône carré centré au trait) puis `.vtk3d-reset`, tous deux `class="vp-btn …"` ; ordre cadre → barre → texte.
- [ ] **Step 2 : logique** — `createPlayer` remplace `goTo`/`setInterval`/boutons ; `zoom = limitZoomOut(renderer, cam)` ; `zoom.reset()` remplace `renderer.resetCamera()` aux lignes 469, 521, 531, 540 (le bornage suit donc la projection active).
- [ ] **Step 3 : vérifier** — `npm run build` ; page d'une figure 3D (JSON avec `dic` ou `fe`) : mêmes contrôles qu'en Task 2 ; rotation au glissé sur le champ uniquement ; molette arrière bornée en perspective **et** après ⊡ ; ⟳ restaure la vue.
- [ ] **Step 4 : point de commit** : `feat: figure 3D sur le lecteur commun`.

---

### Task 5 : migration champ + courbe

**Files :**
- Modify : `src/components/FieldCurve.astro` (l. 51-85)
- Modify : `src/scripts/field-curve-runtime.ts` (reset l. 194, 280 ; champs et lecture l. 209-270)

**Interfaces :**
- Consumes : `VtkPlayerBar`, `createPlayer`, `limitZoomOut`.

- [ ] **Step 1 : balisage** — `.fc-field` reçoit la classe `field-frame` (cadre autour du champ seul, la courbe reste sur le fond) ; `.fc-fields` et `.fc-reset` retirés ; `.fc-controls` remplacé par `<VtkPlayerBar>` avec `.fc-reset` en slot. La hauteur totale (`height`) ne change pas : `.fc-row` garde `flex: 1`, la barre prend sa hauteur naturelle.
- [ ] **Step 2 : logique** — `createPlayer` remplace `goTo`/`setInterval` ; `render(step, field)` = `renderField` + mise à jour du marqueur de la courbe comme aujourd'hui ; `limitZoomOut` + `zoom.reset()` aux lignes 194 et 280.
- [ ] **Step 3 : vérifier** — `npm run build` ; page d'une figure champ + courbe (JSON avec `curves` et `coords`) : marqueur de la courbe suit le slider et la lecture ; empilement sous 720 px intact ; zoom borné.
- [ ] **Step 4 : point de commit** : `feat: figure champ+courbe sur le lecteur commun`.

---

### Task 6 : migration de la comparaison

**Files :**
- Modify : `src/components/VtkFigureCompare.astro` (l. 24, 36-37, 49-58)
- Modify : `src/scripts/vtk-compare-runtime.ts` (cadre panneau l. 112, reset l. 304 et 426, champs et lecture l. 311-376, bouton lien l. 407-420)

**Interfaces :**
- Consumes : `VtkPlayerBar`, `createPlayer`, `limitZoomOut`.

- [ ] **Step 1 : balisage** — `.vtkc-fields` du haut supprimé ; `.vtkc-controls` remplacé par `<VtkPlayerBar>` ; slot : `.vtkc-link` (`aria-pressed` selon l'état lié, icône lien au trait, plus d'emoji 🔗/🚫) puis `.vtkc-reset`. Chaque `wrap` de panneau (l. 112) prend la classe `field-frame` à la place de sa bordure inline ; la barre de couleur `.vtkc-cb` reste hors cadre.
- [ ] **Step 2 : logique** — `createPlayer` remplace `goTo` et la garde `pos2` ; un `limitZoomOut` par panneau, `p.zoom.reset()` remplace `p.renderer.resetCamera()` (l. 304, 426). `refreshLinkBtn` met à jour `aria-pressed` et le `title` au lieu du texte et du fond.
- [ ] **Step 3 : vérifier** — `npm run build` ; page d'une comparaison (JSON avec `panels`) : changement de composante sur tous les panneaux ; molette arrière bornée sur un panneau, caméras liées **et** déliées, sans gel de la page (pas de boucle `onModified`) ; ⟳ réaligne.
- [ ] **Step 4 : point de commit** : `feat: comparaison sur le lecteur commun`.

---

### Task 7 : nettoyage et contrôle final

**Files :**
- Modify : `.gitignore` (ajouter `.superpowers/`)

- [ ] **Step 1 :** `grep -rn "setInterval\|⏮\|⏪\|⏩\|⏭\|accent-color" src/components/VtkFigure*.astro src/components/FieldCurve.astro src/scripts/field-curve-runtime.ts src/scripts/vtk-compare-runtime.ts` — attendu : aucune occurrence (histogrammes et Plot1D, hors périmètre, peuvent en garder).
- [ ] **Step 2 :** ajouter `.superpowers/` à `.gitignore`.
- [ ] **Step 3 :** `node scripts/verify-vtk-player.mjs && npm run build` — attendu : vert.
- [ ] **Step 4 :** revue de branche (agent `ecc:typescript-reviewer`) ; corriger CRITICAL/HIGH.
- [ ] **Step 5 : point de commit** : `chore: nettoyage lecteur commun, .superpowers ignoré`.
