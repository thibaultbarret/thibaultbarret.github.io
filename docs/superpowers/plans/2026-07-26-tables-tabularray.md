# Rendu des tableaux (style tabularray/booktabs) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à tout tableau markdown GFM le rendu visuel de `tabularray`/`booktabs`, automatiquement, dans les deux contextes de contenu (`.prose` et `.prose-manuscrit`), en clair et en sombre.

**Architecture:** (1) Un plugin rehype enveloppe chaque `<table>` dans un `<div class="table-scroll">` défilable (responsive + sémantique préservée). (2) Un bloc CSS unique dans `global.css`, en sélecteurs groupés `.prose … , .prose-manuscrit …`, applique les filets booktabs, l'aération, `tabular-nums` et l'alignement GFM. Aucun changement de syntaxe d'authoring.

**Tech Stack:** Astro 5 (markdown GFM par défaut), rehype/hast, `unist-util-visit` (déjà présent), Tailwind v4 (preflight), CSS custom, Node ≥22.12 (test runner via script `node:assert`).

**Spec de référence :** `docs/superpowers/specs/2026-07-26-tables-tabularray-design.md`

## Global Constraints

- **Deux contextes obligatoires** : toute règle de rendu de contenu doit couvrir `.prose` ET `.prose-manuscrit` (cf. LRN-030 — les chapitres du manuscrit n'utilisent PAS `.prose`).
- **Aucune nouvelle dépendance** : `unist-util-visit` est déjà installé (utilisé par `src/plugins/remark-treesitter.mjs`).
- **Tailwind v4 preflight** neutralise bordures et `border-collapse` → il faut poser `border-collapse: collapse` et les bordures explicitement.
- **Accent mauve tenu hors des tableaux** : filets monochromes (`--text` / `--border`), en-tête non teinté, pas de fond d'en-tête.
- **Alignement GFM préservé** : ne pas écraser l'alignement par colonne (`:---` / `:---:` / `---:`).
- **Couleurs via variables Catppuccin uniquement** (`--text`, `--text-muted`, `--border`) → clair/sombre automatique.
- **Node ≥ 22.12** ; pas de framework de test — vérification par script `.mjs` autonome (`node:assert`), convention `scripts/verify-*.mjs`.
- **Vérif visuelle sur page buildée réelle de CHAQUE contexte**, jamais un seul preview `.prose` (piège LRN-030).

---

### Task 1 : Plugin rehype d'enveloppe défilable

**Files:**
- Create: `src/plugins/rehype-table-wrap.mjs`
- Create: `scripts/verify-table-wrap.mjs`
- Modify: `astro.config.mjs:1-19` (import + enregistrement dans `markdown.rehypePlugins`)

**Interfaces:**
- Produces: `export default function rehypeTableWrap()` — plugin rehype (retourne un transformer `(tree) => void`) qui, pour chaque nœud hast `element` de `tagName === 'table'` non déjà enveloppé, remplace ce nœud dans `parent.children[index]` par un `element` `div` de `properties.className = ['table-scroll']` dont l'unique enfant est le tableau. Idempotent.

- [ ] **Step 1 : Écrire le script de vérification (qui échoue)**

Create `scripts/verify-table-wrap.mjs` :

```js
import assert from 'node:assert/strict';
import rehypeTableWrap from '../src/plugins/rehype-table-wrap.mjs';

const el = (tagName, children = [], properties = {}) => ({
  type: 'element', tagName, properties, children,
});

// Arbre hast : un <table> et un <p> frères sous la racine
const tree = {
  type: 'root',
  children: [
    el('table', [el('thead'), el('tbody')]),
    el('p', [{ type: 'text', value: 'x' }]),
  ],
};

// 1) enveloppe le tableau
rehypeTableWrap()(tree);
const wrap = tree.children[0];
assert.equal(wrap.tagName, 'div', 'le tableau doit être enveloppé dans un div');
assert.ok(
  Array.isArray(wrap.properties.className) &&
    wrap.properties.className.includes('table-scroll'),
  'le div doit porter la classe table-scroll'
);
assert.equal(wrap.children[0].tagName, 'table', 'le div enveloppe le tableau');

// 2) laisse les autres nœuds intacts
assert.equal(tree.children[1].tagName, 'p', 'le paragraphe reste intact');

// 3) idempotent : un 2e passage ne double pas l'enveloppe
rehypeTableWrap()(tree);
assert.equal(tree.children[0].tagName, 'div');
assert.equal(tree.children[0].children[0].tagName, 'table');
assert.notEqual(
  tree.children[0].children[0].children[0]?.tagName,
  'div',
  'pas de double enveloppe'
);

console.log('OK rehype-table-wrap');
```

- [ ] **Step 2 : Lancer le script — il doit échouer**

Run: `node scripts/verify-table-wrap.mjs`
Expected: échec (`ERR_MODULE_NOT_FOUND` : `src/plugins/rehype-table-wrap.mjs` n'existe pas encore).

- [ ] **Step 3 : Écrire le plugin**

Create `src/plugins/rehype-table-wrap.mjs` :

```js
import { visit, SKIP } from 'unist-util-visit';

/**
 * Enveloppe chaque <table> dans <div class="table-scroll"> (défilement
 * horizontal responsive, sémantique du tableau préservée). Idempotent.
 */
export default function rehypeTableWrap() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === null) return;

      // déjà enveloppé ? on ne retouche pas
      const cls = parent.properties?.className;
      if (
        parent.tagName === 'div' &&
        Array.isArray(cls) &&
        cls.includes('table-scroll')
      ) {
        return;
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'] },
        children: [node],
      };
      return SKIP; // ne pas redescendre dans le tableau déplacé
    });
  };
}
```

- [ ] **Step 4 : Lancer le script — il doit passer**

Run: `node scripts/verify-table-wrap.mjs`
Expected: `OK rehype-table-wrap` (sortie code 0).

- [ ] **Step 5 : Enregistrer le plugin dans la config Astro**

Modify `astro.config.mjs` — ajouter l'import (après la ligne 7) :

```js
import rehypeTableWrap from './src/plugins/rehype-table-wrap.mjs';
```

et l'ajouter en fin de `rehypePlugins` (ligne 14) :

```js
    rehypePlugins: [[rehypeKatex, { macros: katexMacros }], rehypeTableWrap],
```

- [ ] **Step 6 : Vérifier que le build passe toujours**

Run: `npm run build`
Expected: build OK, aucune erreur (le nombre de pages doit rester identique au build précédent, ~20).

- [ ] **Step 7 : Commit**

```bash
git add src/plugins/rehype-table-wrap.mjs scripts/verify-table-wrap.mjs astro.config.mjs
git commit -m "feat(tables): plugin rehype d'enveloppe défilable des tableaux

Chaque <table> markdown est enveloppé dans <div class=\"table-scroll\">
(défilement horizontal responsive, sémantique préservée). Idempotent.
Vérifié par scripts/verify-table-wrap.mjs (node:assert).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2 : Style visuel booktabs (global.css)

**Files:**
- Modify: `src/styles/global.css` (nouveau bloc « Tableaux », après le bloc « Listes »)

**Interfaces:**
- Consumes: la classe `.table-scroll` produite par le plugin de la Task 1 ; les variables Catppuccin `--text`, `--text-muted`, `--border` déjà définies en haut de `global.css` (clair `:root` / sombre `.dark`).

- [ ] **Step 1 : Ajouter le bloc CSS des tableaux**

Modify `src/styles/global.css` — ajouter à la suite du bloc des listes à puces :

```css
/* ── Tableaux — style tabularray / booktabs ──────────────────────────────── */
/* Enveloppe défilable (produite par le plugin rehype-table-wrap). */
.table-scroll { overflow-x: auto; margin: 1.5rem 0; -webkit-overflow-scrolling: touch; }

/* Tableau : filets horizontaux uniquement, chiffres à chasse fixe. */
.prose table,
.prose-manuscrit table {
  border-collapse: collapse;
  width: auto;
  color: var(--text-muted);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

/* Aération ; première/dernière colonne à fleur des marges (façon @{} booktabs). */
.prose th,        .prose td,
.prose-manuscrit th, .prose-manuscrit td {
  padding: 0.5em 0.9em;
  text-align: left;                 /* l'alignement inline GFM (---:) reste prioritaire */
  vertical-align: baseline;
}
.prose th:first-child,        .prose td:first-child,
.prose-manuscrit th:first-child, .prose-manuscrit td:first-child { padding-left: 0; }
.prose th:last-child,         .prose td:last-child,
.prose-manuscrit th:last-child,  .prose-manuscrit td:last-child  { padding-right: 0; }

/* En-tête : gras, sans fond ; toprule (épais) + midrule (fin). */
.prose thead th,
.prose-manuscrit thead th {
  font-weight: 600;
  color: var(--text);
  border-top: 1.5px solid var(--text);      /* toprule */
  border-bottom: 1px solid var(--border);   /* midrule */
}
/* bottomrule (épais) sous la dernière ligne du corps. */
.prose tbody tr:last-child td,
.prose-manuscrit tbody tr:last-child td {
  border-bottom: 1.5px solid var(--text);
}

/* Filet de repli si l'alignement GFM sort en attribut align= plutôt qu'en style. */
.prose [align="right"],  .prose-manuscrit [align="right"]  { text-align: right; }
.prose [align="center"], .prose-manuscrit [align="center"] { text-align: center; }
```

- [ ] **Step 2 : Build**

Run: `npm run build`
Expected: build OK (~20 pages).

- [ ] **Step 3 : Confirmer que les règles sont compilées pour les DEUX contextes**

Run:
```bash
C=$(ls dist/_astro/index.*.css | head -1)
grep -o '\.prose table' "$C" | head -1
grep -o '\.prose-manuscrit table' "$C" | head -1
grep -o '\.table-scroll' "$C" | head -1
```
Expected: les trois motifs présents.

- [ ] **Step 4 : Insérer un tableau de test dans chaque contexte (temporaire)**

> Fichiers choisis car **propres** (hors WIP utilisateur ; ne PAS toucher `03-resultats.md`).

Append à `src/content/programming/01-tree-sitter.md` (contexte `.prose`) ET à `src/content/chapters/01-introduction.md` (contexte `.prose-manuscrit`) le même tableau :

```markdown

## Tableau de test (à retirer)

| Paramètre               | Symbole | Valeur | Unité |
|:------------------------|:-------:|-------:|:-----:|
| Module d'Young          | E       |    210 | GPa   |
| Coefficient de Poisson  | ν       |   0.30 | –     |
| Limite d'élasticité     | σ_y     |    250 | MPa   |
```

- [ ] **Step 5 : Build + capture des deux vraies pages**

```bash
npm run build
cd dist && python3 -m http.server 8901 &   # (run_in_background)
```
Trouver les URLs buildées :
```bash
find dist/programmation -name index.html   # page .prose (tree-sitter)
find dist/manuscrit -name index.html       # chapitre .prose-manuscrit (introduction)
```
Capturer chaque page en headless (cf. LRN-030 pour la méthode Chrome headless + `http.server`) :
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --window-size=1000,900 --virtual-time-budget=3000 \
  --screenshot=/tmp/table_prose.png "http://localhost:8901/programmation/tree-sitter/"
```
(idem pour la page manuscrit introduction).

Lire les captures et **vérifier visuellement** :
- toprule + midrule + bottomrule présents ; **aucun filet vertical ni inter-ligne** ;
- en-tête gras sans fond ;
- colonnes « Valeur » (`---:`) **alignées à droite**, chiffres `210 / 0.30 / 250` **alignés verticalement** (tabular-nums) ;
- première colonne à fleur de la marge gauche du texte, dernière à fleur à droite ;
- rendu identique dans les deux contextes.

- [ ] **Step 6 : Vérifier le mode sombre (preview bithème)**

> Valide ici car **tout** le CSS des tableaux vit dans `global.css` (aucune règle scoped à manquer, contrairement au piège LRN-030 sur `.prose-manuscrit`).

Créer un fichier preview qui charge le CSS compilé (`cp dist/_astro/index.*.css preview.css`) et affiche, en deux colonnes (`<div class="prose">…</div>` fond clair, `<div class="prose-manuscrit dark">…</div>` fond `#1e1e2e`), le même tableau enveloppé exactement comme le plugin le produit :

```html
<div class="table-scroll">
  <table><thead><tr>
    <th>Paramètre</th><th style="text-align:center">Symbole</th>
    <th style="text-align:right">Valeur</th><th style="text-align:center">Unité</th>
  </tr></thead><tbody>
    <tr><td>Module d'Young</td><td style="text-align:center">E</td>
        <td style="text-align:right">210</td><td style="text-align:center">GPa</td></tr>
    <tr><td>Coefficient de Poisson</td><td style="text-align:center">ν</td>
        <td style="text-align:right">0.30</td><td style="text-align:center">–</td></tr>
    <tr><td>Limite d'élasticité</td><td style="text-align:center">σ_y</td>
        <td style="text-align:right">250</td><td style="text-align:center">MPa</td></tr>
  </tbody></table>
</div>
```

Capturer en headless, lire l'image, confirmer que filets et texte restent lisibles sur fond sombre (`--text` = clair, `--border` visible).

- [ ] **Step 7 : Retirer les tableaux de test**

```bash
git checkout -- src/content/programming/01-tree-sitter.md src/content/chapters/01-introduction.md
```
Vérifier : `git status -s` ne montre plus ces deux fichiers modifiés.

- [ ] **Step 8 : Arrêter le serveur de preview**

```bash
pkill -f "http.server 8901"
```

- [ ] **Step 9 : Commit**

> Note : `global.css` porte aussi les modifs « listes à puces » non committées (décidé à la création de la branche : elles partent avec cette feature — staging partiel indisponible ici). Commit assumé tel quel sur `feat/tables-tabularray`.

```bash
git add src/styles/global.css
git commit -m "feat(tables): rendu booktabs des tableaux (.prose + .prose-manuscrit)

Filets toprule/midrule/bottomrule monochromes, aucun filet vertical ni
inter-ligne, en-tête gras sans fond, colonnes à fleur, tabular-nums,
alignement GFM préservé. Enveloppe .table-scroll pour la responsivité.
Couvre les deux contextes de contenu, clair et sombre.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3 : Câbler les tableaux GFM dans le pipeline du manuscrit

**Contexte (ajouté après découverte en implémentation) :** les chapitres du manuscrit ne passent PAS par le pipeline markdown standard d'Astro (`astro.config.mjs`), mais par un `unified()` fait main dans `src/pages/manuscrit/[chapterSlug]/index.astro` (lignes ~32-38) qui **n'inclut ni `remark-gfm` ni `rehypeTableWrap`**. Résultat : un tableau markdown dans un chapitre sort en texte brut, jamais en `<table>` → le CSS `.prose-manuscrit table` (Task 2) est correct mais inerte. Cette tâche câble le pipeline pour que les tableaux fonctionnent aussi dans le manuscrit.

**Décision utilisateur (écart assumé au plan initial) :** l'ajout de la dépendance `remark-gfm` est approuvé malgré la Global Constraint « aucune nouvelle dépendance » (elle visait les Tasks 1-2). L'utilisateur accepte aussi que `remark-gfm` **active tout le GFM dans les chapitres** (barré `~~x~~`, listes de tâches, autoliens), pas seulement les tableaux.

**Files:**
- Modify: `src/pages/manuscrit/[chapterSlug]/index.astro` (imports + chaîne `unified()`)
- Modify: `package.json` (ajout de `remark-gfm` en dépendance directe)

**Interfaces:**
- Consumes: `rehypeTableWrap` (export default de `src/plugins/rehype-table-wrap.mjs`, Task 1) et le CSS `.prose-manuscrit table` (Task 2). `remark-gfm` v4.0.1 (déjà dans `node_modules`, transitif).

- [ ] **Step 1 : Déclarer `remark-gfm` en dépendance directe**

Modify `package.json` — ajouter dans `"dependencies"` (ordre alphabétique, entre `github-slugger` et `rehype-katex`) :

```json
    "remark-gfm": "^4.0.1",
```

Ne PAS lancer `npm install` (le paquet est déjà présent en 4.0.1 dans `node_modules`). Vérifier la version : `node -p "require('./node_modules/remark-gfm/package.json').version"` doit afficher `4.0.1`.

- [ ] **Step 2 : Ajouter les imports dans `index.astro`**

Modify `src/pages/manuscrit/[chapterSlug]/index.astro` — après la ligne `import rehypeStringify from 'rehype-stringify';` (≈ ligne 11), ajouter :

```js
import remarkGfm from 'remark-gfm';
import rehypeTableWrap from '../../../plugins/rehype-table-wrap.mjs';
```

(Le chemin `../../../plugins/…` est correct : identique en profondeur à l'import existant `import '../../../styles/global.css';`.)

- [ ] **Step 3 : Insérer les plugins dans la chaîne `unified()`**

Modify la définition `const processor = unified()…` (≈ lignes 32-38). Ajouter `.use(remarkGfm)` juste après `.use(remarkParse)`, et `.use(rehypeTableWrap)` juste après `.use(remarkRehype)`. Résultat attendu :

```js
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeTableWrap)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeStringify);
```

Ordre important : `remarkGfm` en phase mdast (après le parse) ; `rehypeTableWrap` en phase hast (après `remarkRehype`, qui produit le hast).

- [ ] **Step 4 : Build**

Run: `npm run build`
Expected: build OK (~20 pages), aucune erreur.

- [ ] **Step 5 : Vérifier sur une VRAIE page chapitre du manuscrit**

Insérer temporairement, à la fin de `src/content/chapters/01-introduction.md` (fichier propre — NE PAS toucher `03-resultats.md`), ce tableau :

```markdown

## Tableau de test (à retirer)

| Paramètre               | Symbole | Valeur | Unité |
|:------------------------|:-------:|-------:|:-----:|
| Module d'Young          | E       |    210 | GPa   |
| Coefficient de Poisson  | ν       |   0.30 | –     |
| Limite d'élasticité     | σ_y     |    250 | MPa   |
```

Puis :
```bash
npm run build
# trouver la page chapitre buildée (slug dérivé du titre) :
find dist/manuscrit -name index.html
cd dist && python3 -m http.server 8902 &   # (backgrounded ; relancer APRÈS le build)
```
Capturer la vraie page du chapitre « introduction » en headless (Chrome `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, cf. Task 2 pour la commande) et **lire l'image** (outil Read). Confirmer :
- le tableau est un vrai `<table>` **stylé booktabs** (pas du texte brut) → prouve que `remark-gfm` parse ET que `rehypeTableWrap` enveloppe ET que le CSS `.prose-manuscrit` s'applique ;
- colonne « Valeur » alignée à droite, chiffres alignés ;
- aucun filet vertical/inter-ligne.

Vérifier aussi dans le HTML généré : `grep -o 'table-scroll' <page>` renvoie au moins une occurrence.

- [ ] **Step 6 : Retirer le tableau de test**

```bash
git checkout -- src/content/chapters/01-introduction.md
```
Confirmer via `git status -s` que le fichier ne figure plus.

- [ ] **Step 7 : Arrêter le serveur**

```bash
pkill -f "http.server 8902"
```

- [ ] **Step 8 : Commit**

```bash
git add package.json "src/pages/manuscrit/[chapterSlug]/index.astro"
git commit -m "feat(tables): activer les tableaux GFM dans le pipeline du manuscrit

Le rendu des chapitres passe par un unified() dédié qui n'avait ni
remark-gfm ni rehypeTableWrap : les tableaux markdown y sortaient en
texte brut. Ajout de remark-gfm (dépendance directe, v4.0.1) et de
rehypeTableWrap à la chaîne → les tableaux booktabs (Task 2) s'appliquent
désormais aussi au contexte .prose-manuscrit. Active le GFM complet dans
les chapitres (choix validé).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Couverture du spec :**
- Enveloppe défilable / plugin rehype → Task 1. ✓
- Bloc CSS unique, deux contextes → Task 2 (sélecteurs groupés). ✓
- Filets booktabs (top/mid/bottom, pas de vertical/inter-ligne) → Task 2 Step 1. ✓
- Aération + colonnes à fleur → Task 2 Step 1. ✓
- En-tête gras sans fond, mauve hors tableau → Task 2 Step 1. ✓
- `tabular-nums` + alignement GFM (avec repli `align=`) → Task 2 Step 1 + vérif Step 5. ✓
- Thème clair/sombre → variables Catppuccin + vérif Step 6. ✓
- Responsive → `.table-scroll` + vérif implicite. ✓
- Sémantique préservée (`<div>` enveloppe, `<table>` intact) → Task 1 + test idempotence. ✓
- Vérif sur page buildée réelle des DEUX contextes → Task 2 Steps 4-5. ✓
- Hors périmètre (fusions, alignement décimal, légendes) → non implémenté, conforme. ✓

**Placeholders :** aucun — tout le code (plugin, test, CSS, markdown de test, HTML preview) est fourni intégralement.

**Cohérence des types/noms :** `rehypeTableWrap` (export default), classe `table-scroll`, variables `--text`/`--text-muted`/`--border` — identiques entre spec, Task 1 et Task 2.
