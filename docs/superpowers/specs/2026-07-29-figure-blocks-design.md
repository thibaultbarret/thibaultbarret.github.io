# Déclaration des figures via un bloc ` ```figure ` inline

- **Date :** 2026-07-29
- **Statut :** design validé, prêt pour le plan
- **Motivation :** la déclaration actuelle (tableau `figures:` en frontmatter + marqueurs `<!-- figure: N -->` référençant par index) découple la déclaration de l'endroit du texte et oblige à jongler avec des indices. On la remplace par un bloc autonome posé là où la figure apparaît.

## Objectif

Déclarer chaque figure d'un chapitre du manuscrit par un **bloc ` ```figure `** placé dans le corps, à l'endroit où la figure doit apparaître. Le bloc porte exactement trois clés : `filename`, `title`, `slug`. Il devient la **source unique** ; le tableau `figures:` du frontmatter et les marqueurs `<!-- figure: N -->` disparaissent.

Syntaxe cible :

````markdown
```figure
filename: "Traction_homogene-champ_deformation_cin.json"
title: "Figure 4.1 — Traction homogène - Champ déformation calculé par la DIC"
slug: "traction-homogene-champ-deformation-calcule-par-matchid"
```
````

## Comportement (inchangé, seule la déclaration change)

- **Page chapitre** (`index.astro`) : à l'emplacement du bloc, on rend **la carte-lien** existante (`▶ {title}` → `/manuscrit/{chapterSlug}/{slug}`). On ne monte PAS la figure interactive dans le chapitre — c'est déjà le comportement actuel. Aucun runtime VTK/uPlot à charger côté chapitre.
- **Page dédiée** (`[figSlug].astro`) : rendu interactif inchangé (détection de type par les clés du JSON, composants VtkFigure/VtkFigureCompare/Plot1D/FieldCurve/Histogram/VtkFigure3D/JS/iframe). Seule sa **découverte de routes** change de source.
- **Numérotation** : reste manuelle, écrite dans `title`.
- **Champs morts supprimés** : `field`, `cmap`, `opacity`, `image` du schéma `figures` n'étaient ni renseignés en pratique ni lus (tout vient du JSON) — ils disparaissent avec le tableau `figures:`.

## État actuel (constaté)

- `content.config.ts` : `chapters.figures` = `array({ filename, title, slug?, image?, field?, cmap='RdYlGn_r', opacity=0.8 })`.
- `index.astro` : `parseBody(body)` découpe le corps sur `MARKER = /<!--\s*figure:\s*(\d+)\s*-->/g`, produit des segments `{type:'text', html}` (texte passé dans le pipeline unified) et `{type:'figure', index}`. Le template rend un segment figure en **carte-lien** via `chapter.data.figures[index]`. Les figures du frontmatter non référencées dans le corps (`unrefFigs`) sont listées en fin de contenu.
- `[figSlug].astro` : `getStaticPaths` mappe `chapter.data.figures` → routes `{chapterSlug, figSlug: fig.slug ?? index}` ; navigation préc./suiv. via l'index dans ce tableau ; détection de type en lisant le JSON `public/figures/manuscrit/<filename>`.
- `03-resultats.md` : 11 figures en frontmatter (index 0–10) ; marqueurs corps pour 0,3,1,2,4,5,6,7,8,9 (pas dans l'ordre) ; **index 10 jamais placé** (unrefFig) ; les index 6 et 7 partagent le même `filename`.
- `js-yaml` disponible dans `node_modules` (pas `yaml`).

## Architecture cible

### 1. Module partagé — `src/lib/chapter-figures.ts` (nouveau)

Source unique de la logique de parsing, pour ne pas dupliquer entre les deux pages.

- `FIGURE_BLOCK_RE` : détecte un bloc clôturé de langage `figure` en début de ligne, p. ex. `/^```figure[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm`.
- `type FigureDecl = { filename: string; title: string; slug: string }`.
- `parseFigureBlock(inner: string): FigureDecl` : parse le YAML interne via `js-yaml` ; valide la présence des trois clés (sinon lève une erreur de build explicite nommant le chapitre).
- `extractFigures(body: string): FigureDecl[]` : renvoie les déclarations dans l'ordre du document. Utilisé par `[figSlug].astro`.

Décision : `slug` est **obligatoire** dans le bloc (plus de repli sur l'index, puisqu'il n'y a plus d'index). Un bloc sans `slug` → erreur de build claire.

### 2. Page chapitre — `src/pages/manuscrit/[chapterSlug]/index.astro`

- `parseBody` découpe désormais sur `FIGURE_BLOCK_RE` (importé du module partagé) au lieu de `MARKER`. Chaque bloc figure → segment `{type:'figure', fig: FigureDecl}` (porte les données parsées, plus d'index).
- Type `Segment` : `{type:'figure'; fig: FigureDecl}` au lieu de `{type:'figure'; index}`.
- Template : le segment figure rend la carte-lien à partir de `seg.fig.title`/`seg.fig.slug` directement.
- **Suppression** de `referencedFigs`/`unrefFigs` et du bloc `<ul>` associé : toute figure est déclarée inline, il n'y a plus de figures « orphelines ».
- Le texte hors blocs est traité par le pipeline unified **inchangé** (les blocs sont retirés du texte avant traitement, comme les marqueurs aujourd'hui — donc jamais rendus en bloc de code).

### 3. Page dédiée — `src/pages/manuscrit/[chapterSlug]/[figSlug].astro`

- `getStaticPaths` : pour chaque chapitre affiché, `const figs = extractFigures(chapter.body ?? '')` ; routes `{ chapterSlug: chapter.slug, figSlug: fig.slug }` ; props `{ chapter, fig, figIndex, figs }`.
- Navigation préc./suiv. : dérivée de `figs` (ordre du corps) au lieu de `chapter.data.figures`.
- Détection de type et rendu : **inchangés** (lecture du JSON par `fig.filename`).

### 4. Schéma — `src/content/config.ts`

- Retirer entièrement la clé `figures` de `chapters.schema`. Le corps est la source.

### 5. Migration du contenu

- Tout chapitre déclarant un `figures:` en frontmatter (aujourd'hui **`03-resultats.md`** uniquement — à confirmer par recherche au plan) est migré :
  - suppression du tableau `figures:` du frontmatter ;
  - remplacement de chaque `<!-- figure: N -->` par le bloc ` ```figure ` correspondant (reprend `filename`/`title`/`slug` de l'entrée d'index N) ;
  - les figures déclarées mais **non placées** dans le corps (index 10 de `03-resultats.md`) reçoivent un bloc, placé en fin de section pertinente (choix éditorial à confirmer avec l'utilisateur au moment de la migration — repli : à la fin du chapitre).
- `03-resultats.md` a des modifications non committées de l'utilisateur : la migration édite ce fichier avec précaution (ne pas écraser son WIP de texte ; ne toucher qu'au frontmatter `figures:` et aux marqueurs).

## Contraintes / décisions figées

- **Clés du bloc** : `filename`, `title`, `slug` — exactement (validé).
- **Parsing** : regex sur le corps brut (comme le `MARKER` actuel) + `js-yaml` pour le YAML interne. Cohérent avec le code existant.
- **`slug` obligatoire** dans le bloc.
- **Deux pages, deux pipelines** : rappel LRN-030/031 — ce travail touche le contexte manuscrit ; vérifier sur pages buildées réelles.

## Hors périmètre

- Rendu de la figure interactive *dans* le fil du chapitre (on garde la carte-lien + page dédiée).
- Numérotation automatique.
- Modification des composants de figure ou du format des JSON.

## Vérification

- `npm run build` sans erreur (le schéma sans `figures` + corps migré doivent construire les 20 pages, dont toutes les routes `[figSlug]`).
- Chaque `slug` de figure reste atteignable (mêmes URLs qu'avant la migration → pas de lien cassé).
- Page chapitre : cartes-liens rendues dans l'ordre des blocs, aux bons emplacements.
- Page figure : préc./suiv. cohérents avec l'ordre du corps ; rendu interactif intact.
- Contrôle visuel headless (cf. LRN-030) sur une vraie page chapitre **et** une vraie page figure buildées.
- Test du module partagé (`extractFigures`, `parseFigureBlock`) par script Node `node:assert` (convention `scripts/verify-*.mjs`), incl. bloc valide, bloc sans `slug` (erreur), plusieurs blocs ordonnés.

## Fichiers touchés

- `src/lib/chapter-figures.ts` (nouveau)
- `src/pages/manuscrit/[chapterSlug]/index.astro`
- `src/pages/manuscrit/[chapterSlug]/[figSlug].astro`
- `src/content/config.ts`
- `src/content/chapters/03-resultats.md` (migration ; + tout autre chapitre à `figures:`)
- `scripts/verify-chapter-figures.mjs` (nouveau, test du module partagé)
