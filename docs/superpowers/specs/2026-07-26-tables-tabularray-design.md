# Rendu des tableaux — style tabularray / booktabs

- **Date :** 2026-07-26
- **Statut :** validé (design), prêt pour le plan d'implémentation
- **Périmètre :** rendu visuel automatique des tableaux markdown, sans nouvelle syntaxe d'authoring

## Objectif

Donner à tout tableau écrit en markdown GFM (`| … | … |`) le rendu visuel du package
LaTeX `tabularray` dans son esprit `booktabs`, de façon **automatique** et **cohérente
clair/sombre**, dans les deux contextes de contenu du site : `.prose` (projets,
programmation, recherche) **et** `.prose-manuscrit` (chapitres du manuscrit).

Explicitement **hors périmètre** (couche structurelle de tabularray, reportée) :
alignement sur la virgule décimale (colonnes `siunitx` `S`), cellules fusionnées
(colspan/rowspan), en-têtes groupés, coloration conditionnelle ligne/colonne,
légende et numérotation des tableaux (« Tableau 4.1 »). Ces besoins impliqueraient
un mécanisme d'authoring (HTML brut ou composant) et feront l'objet d'un futur spec.

## Contexte technique (état constaté)

- Astro laisse **GFM activé par défaut** malgré des `remarkPlugins` personnalisés
  (`remarkTreesitter`, `remarkMath`) → les tableaux markdown sont déjà convertis en
  HTML `<table><thead><tr><th>…`.
- **Aucune règle CSS de tableau n'existe** dans le projet (`table`, `th`, `td`,
  `border-collapse` absents de `global.css` comme des `<style>` scoped du manuscrit).
- Tailwind v4 (preflight) neutralise bordures et `border-collapse` → sans CSS
  dédié, un tableau sort dépouillé (pas de filets, colonnes serrées).
- Deux classes de contenu distinctes, à couvrir toutes deux : `.prose`
  (`src/styles/global.css`) et `.prose-manuscrit` (styles scoped dans
  `src/pages/manuscrit/[chapterSlug]/index.astro` et `[figSlug].astro`). Cf. LRN-030.
- `unist-util-visit` est déjà une dépendance (utilisée par `remark-treesitter.mjs`)
  → réutilisable pour un plugin rehype, **sans ajout de dépendance**.
- L'alignement par colonne GFM (`:---` / `:---:` / `---:`) est émis en style inline
  sur les cellules (`text-align`), donc respecté automatiquement si on ne l'écrase pas.

## Architecture

### 1. Enveloppe défilable — plugin rehype

Un tableau markdown sort en `<table>` nu, sans conteneur. Sur mobile, un tableau
large déborde la page. Solution retenue : un **plugin rehype** qui enveloppe chaque
`<table>` dans un `<div class="table-scroll">` défilable horizontalement.

- Nouveau fichier : `src/plugins/rehype-table-wrap.mjs`.
- Utilise `visit` de `unist-util-visit` pour trouver les nœuds `element` de
  `tagName === 'table'` et les remplacer, dans leur parent, par un `element` `div`
  de `properties.className = ['table-scroll']` enveloppant le tableau.
- Idempotent : ne pas re-envelopper un tableau déjà enfant d'un `.table-scroll`
  (vérifier le parent avant de remplacer).
- Enregistré dans `astro.config.mjs`, dans `markdown.rehypePlugins`, **après**
  `rehypeKatex` (l'ordre est sans importance fonctionnelle ici, mais on place le
  nôtre en dernier pour rester lisible).

Alternative écartée : `table { display:block; overflow-x:auto }` en CSS pur — plus
simple mais dégrade la sémantique tableau pour certaines technologies d'assistance.

Le `<div class="table-scroll">` sert aussi de **point d'accroche futur** pour une
éventuelle légende / numérotation de tableau (hors périmètre actuel).

### 2. Style visuel — bloc unique dans `global.css`

Un seul bloc dans `src/styles/global.css`, en **sélecteurs groupés**
`.prose … , .prose-manuscrit …`, source de vérité unique pour les deux contextes
(même approche que les listes à puces, cf. LRN-030). Aucun conflit de spécificité :
il n'existe aucune autre règle de tableau dans le projet.

## Spécification visuelle (ADN booktabs)

Cible :

```
Paramètre           Symbole   Valeur   Unité
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   toprule (épais)
Paramètre           Symbole   Valeur   Unité   ← en-tête (gras, sans fond)
─────────────────────────────────────────────   midrule (fin)
Module d'Young         E         210     GPa
Coeff. de Poisson      ν        0.30      –
Limite d'élasticité    σ_y       250     MPa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   bottomrule (épais)
```

Règles de style (valeurs indicatives, à affiner en revue visuelle) :

- **Filets horizontaux uniquement, aucun filet vertical.**
  - **toprule** (au-dessus de l'en-tête) : ~1,5 px `solid var(--text)`.
  - **midrule** (sous l'en-tête) : ~1 px `solid var(--border)`.
  - **bottomrule** (sous la dernière ligne du corps) : ~1,5 px `solid var(--text)`.
  - **Aucun filet entre les lignes de données** (signature booktabs, l'aération suffit).
  - Implémentation via `border-collapse: collapse` puis bordures posées sur
    `thead th` (top + bottom) et `tbody tr:last-child td` (bottom).
- **Aération** : `padding` cellules ~`0.5em 0.9em`. Première/dernière colonne **à
  fleur** des marges du texte (`padding-left: 0` sur `*:first-child`,
  `padding-right: 0` sur `*:last-child`) — équivalent du `@{}` de booktabs.
- **En-tête** : `font-weight: 600`, couleur `var(--text)` (plus soutenue que le corps
  en `var(--text-muted)`), **sans fond coloré** (booktabs pur).
- **Corps** : couleur `var(--text-muted)`, `line-height` confortable (~1.5).
- **Nombres** : `font-variant-numeric: tabular-nums` sur le tableau → chiffres à
  chasse fixe, colonnes de nombres alignées verticalement sans passer en police mono.
  L'alignement à droite (`---:` GFM, style inline) n'est **pas** écrasé.
- **Accent mauve tenu hors des tableaux** (filets monochromes, en-tête non teinté) —
  choix délibéré de sobriété, pour ne pas concurrencer les titres colorés du site.
- **Marges du bloc** : `.table-scroll { margin: 1.5rem 0; overflow-x: auto; }`
  (+ défilement tactile fluide).

## Quality floor

- **Responsive** : débordement horizontal contenu dans `.table-scroll` sur petit écran ;
  la page ne défile jamais horizontalement.
- **Thème** : toutes les couleurs via variables Catppuccin (`--text`, `--text-muted`,
  `--border`) → clair/sombre automatique.
- **Sémantique préservée** : le `<table>` reste un `<table>` (l'enveloppe est un `<div>`).
- **Reduced motion** : sans objet (aucune animation ajoutée).

## Vérification

- Build `npm run build` sans erreur.
- CSS compilé contient les règles `.prose table` **et** `.prose-manuscrit table`.
- HTML généré : chaque `<table>` est bien enfant d'un `<div class="table-scroll">`.
- Contrôle visuel sur une vraie page buildée **de chaque contexte** (une page projet/prog
  en `.prose` ET un chapitre manuscrit en `.prose-manuscrit`), en clair et en sombre,
  via Chrome headless sur `dist/` servi en HTTP (cf. LRN-030 : ne pas se fier à un
  preview `.prose` seul). Nécessite un tableau markdown de test dans chaque contexte.
- Vérifier l'alignement à droite d'une colonne numérique (`---:`) et l'alignement
  des chiffres (`tabular-nums`).

## Fichiers touchés

- `src/plugins/rehype-table-wrap.mjs` (nouveau).
- `astro.config.mjs` (enregistrement du plugin dans `markdown.rehypePlugins`).
- `src/styles/global.css` (bloc de style tableau + `.table-scroll`).
