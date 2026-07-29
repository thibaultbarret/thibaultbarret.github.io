# Déclaration des figures via bloc ` ```figure ` — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la déclaration des figures d'un chapitre (tableau `figures:` en frontmatter + marqueurs `<!-- figure: N -->` par index) par un bloc ` ```figure ` autonome (`filename`/`title`/`slug`) posé dans le corps là où la figure apparaît.

**Architecture:** Un module ESM partagé parse les blocs du corps (source unique). La page chapitre découpe le corps sur ces blocs et rend la carte-lien existante à leur emplacement ; la page figure dérive ses routes et sa navigation des blocs. Le schéma perd `figures:`. Comportement inchangé (carte-lien inline → page dédiée interactive).

**Tech Stack:** Astro 5 (content collections + pipeline `unified()` maison des chapitres), `js-yaml`, Node ≥22.12 (vérif par script `node:assert`).

**Spec de référence :** `docs/superpowers/specs/2026-07-29-figure-blocks-design.md`

## Global Constraints

- **Contexte manuscrit** : les chapitres passent par le `unified()` maison de `index.astro` (cf. LRN-031) ; **vérifier sur pages buildées réelles** (LRN-030), jamais un seul preview.
- **Module partagé en `.mjs`** (ESM), importable à la fois par les `.astro` ET les scripts Node de vérif — même convention que `src/plugins/rehype-table-wrap.mjs`.
- **`js-yaml` déclaré en dépendance directe** dans `package.json` (présent en transitif ; ne pas `npm install`).
- **`slug` obligatoire** dans chaque bloc ; bloc invalide → erreur de build explicite.
- **Comportement inchangé** : la page chapitre rend une **carte-lien** (`▶ {title}` → `/manuscrit/{chapterSlug}/{slug}`), pas la figure interactive ; la page figure reste inchangée dans son rendu. Numérotation manuelle dans `title`.
- **Préserver le WIP utilisateur** dans `03-resultats.md` : ne toucher qu'au frontmatter `figures:` et aux marqueurs `<!-- figure: N -->`, jamais au texte.
- **Figure 4.11** (index 10, non placée aujourd'hui) : bloc ajouté **en fin de chapitre**.
- Pas de nouveau composant de figure, pas de changement du format des JSON.

---

### Task 1 : Module partagé de parsing des blocs figure

**Files:**
- Create: `src/lib/chapter-figures.mjs`
- Create: `scripts/verify-chapter-figures.mjs`
- Modify: `package.json` (ajout `js-yaml` en dépendance directe)

**Interfaces:**
- Produces:
  - `parseFigureBlock(inner: string) -> { filename, title, slug }` — parse le YAML interne d'un bloc via `js-yaml`, exige les 3 clés non vides (sinon `throw`).
  - `splitBody(body: string) -> Array<{kind:'text', content} | {kind:'figure', fig}>` — découpe le corps en parts ordonnées ; les fences ` ```figure ` deviennent des parts `figure` (avec `fig` parsé), le reste des parts `text`.
  - `extractFigures(body: string) -> Array<{filename,title,slug}>` — liste ordonnée des figures du corps.

- [ ] **Step 1 : Déclarer `js-yaml` en dépendance directe**

Vérifier la version : `node -p "require('./node_modules/js-yaml/package.json').version"`.
Modify `package.json` — ajouter dans `dependencies` (ordre alphabétique, entre `github-slugger` et `rehype-katex` ou selon l'ordre existant) la ligne avec la version exacte relevée, p. ex. :
```json
    "js-yaml": "^4.1.0",
```
Ne pas lancer `npm install`.

- [ ] **Step 2 : Écrire le script de vérification (qui échoue)**

Create `scripts/verify-chapter-figures.mjs` :

```js
import assert from 'node:assert/strict';
import { parseFigureBlock, splitBody, extractFigures } from '../src/lib/chapter-figures.mjs';

// bloc valide
assert.deepEqual(
  parseFigureBlock('filename: "a.json"\ntitle: "Figure 1 — X"\nslug: "x"'),
  { filename: 'a.json', title: 'Figure 1 — X', slug: 'x' }
);

// slug manquant -> erreur mentionnant slug
assert.throws(() => parseFigureBlock('filename: "a.json"\ntitle: "t"'), /slug/);

// title vide -> erreur
assert.throws(() => parseFigureBlock('filename: "a.json"\ntitle: ""\nslug: "s"'), /title/);

// découpage + extraction ordonnée
const body = [
  'Intro.', '',
  '```figure', 'filename: "a.json"', 'title: "Figure 1"', 'slug: "a"', '```', '',
  'Milieu.', '',
  '```figure', 'filename: "b.json"', 'title: "Figure 2"', 'slug: "b"', '```', '',
  'Fin.',
].join('\n');

const parts = splitBody(body);
assert.equal(parts.filter(p => p.kind === 'figure').length, 2);
assert.equal(parts[0].kind, 'text');

const figs = extractFigures(body);
assert.deepEqual(figs.map(f => f.slug), ['a', 'b']);
assert.equal(figs[0].filename, 'a.json');

console.log('OK chapter-figures');
```

- [ ] **Step 3 : Lancer — doit échouer**

Run: `node scripts/verify-chapter-figures.mjs`
Expected: échec (`ERR_MODULE_NOT_FOUND` : `src/lib/chapter-figures.mjs` absent).

- [ ] **Step 4 : Écrire le module**

Create `src/lib/chapter-figures.mjs` :

```js
import { load as loadYaml } from 'js-yaml';

/** Fence ` ```figure ` en début de ligne ; capture le YAML interne. */
const FENCE_SOURCE = String.raw`^\x60\x60\x60figure[ \t]*\r?\n([\s\S]*?)\r?\n\x60\x60\x60[ \t]*$`;

/** @typedef {{ filename: string, title: string, slug: string }} FigureDecl */

/** @param {string} inner @returns {FigureDecl} */
export function parseFigureBlock(inner) {
  const data = loadYaml(inner);
  if (!data || typeof data !== 'object') {
    throw new Error('Bloc figure invalide (YAML non-objet).');
  }
  const out = {};
  for (const k of ['filename', 'title', 'slug']) {
    const v = data[k];
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`Bloc figure : clé "${k}" manquante ou vide.`);
    }
    out[k] = v;
  }
  return out;
}

/**
 * Découpe le corps en parts ordonnées (texte / figure).
 * @param {string} body
 * @returns {Array<{kind:'text', content:string} | {kind:'figure', fig:FigureDecl}>}
 */
export function splitBody(body) {
  const parts = [];
  const re = new RegExp(FENCE_SOURCE, 'gm'); // fraîche : pas d'état lastIndex partagé
  let last = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', content: body.slice(last, m.index) });
    parts.push({ kind: 'figure', fig: parseFigureBlock(m[1]) });
    last = re.lastIndex;
  }
  if (last < body.length) parts.push({ kind: 'text', content: body.slice(last) });
  return parts;
}

/** @param {string} body @returns {FigureDecl[]} */
export function extractFigures(body) {
  return splitBody(body).filter((p) => p.kind === 'figure').map((p) => p.fig);
}
```

> Note : `\x60` = backtick, pour ne pas casser la fence markdown de ce plan. L'implémenteur peut écrire les backticks littéralement dans le `.mjs` (`^```figure...`), le résultat doit être le même motif.

- [ ] **Step 5 : Lancer — doit passer**

Run: `node scripts/verify-chapter-figures.mjs`
Expected: `OK chapter-figures`.

- [ ] **Step 6 : Le build reste vert (module non encore consommé)**

Run: `npm run build`
Expected: OK, ~20 pages.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/chapter-figures.mjs scripts/verify-chapter-figures.mjs package.json
git commit -m "feat(figures): module partagé de parsing des blocs figure

parseFigureBlock/splitBody/extractFigures (js-yaml), source unique pour la
déclaration des figures par bloc dans le corps des chapitres. Testé via
scripts/verify-chapter-figures.mjs.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2 : Bascule du code (schéma + deux pages)

> À la fin de cette tâche, le build est **vert mais les figures sont temporairement absentes** (le contenu n'est pas encore migré en blocs — c'est la Task 3 qui les ramène). C'est attendu.

**Files:**
- Modify: `src/content/config.ts` (retrait de `figures` du schéma chapitres)
- Modify: `src/pages/manuscrit/[chapterSlug]/index.astro`
- Modify: `src/pages/manuscrit/[chapterSlug]/[figSlug].astro`

**Interfaces:**
- Consumes: `splitBody`, `extractFigures` (Task 1).

- [ ] **Step 1 : Retirer `figures` du schéma**

Modify `src/content/config.ts` — dans `chapters.schema`, supprimer entièrement la clé `figures: z.array(...)...` (et rien d'autre). Le corps devient la source.

- [ ] **Step 2 : Page chapitre — découper sur les blocs**

Modify `src/pages/manuscrit/[chapterSlug]/index.astro` :

Ajouter l'import (avec les autres, ≈ ligne 13) :
```ts
import { splitBody } from '../../../lib/chapter-figures.mjs';
```

Remplacer le type `Segment` et la fonction `parseBody` (≈ lignes 15-54) par :
```ts
type FigureDecl = { filename: string; title: string; slug: string };
type Segment =
  | { type: 'text';   html: string }
  | { type: 'figure'; fig: FigureDecl };

async function parseBody(body: string): Promise<Segment[]> {
  if (!body?.trim()) return [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeTableWrap)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeStringify);

  const segments: Segment[] = [];
  for (const p of splitBody(body)) {
    if (p.kind === 'figure') {
      segments.push({ type: 'figure', fig: p.fig });
    } else {
      const html = String(await processor.process(p.content));
      if (html.trim()) segments.push({ type: 'text', html });
    }
  }
  return segments;
}
```

Supprimer les lignes calculant `referencedFigs` / `unrefFigs` (≈ 70-75).

Dans le template, remplacer le rendu du segment figure (≈ 111-124) par :
```jsx
            const fig = seg.fig;
            return (
              <div class="my-4">
                <a
                  href={`/manuscrit/${chapterSlug}/${fig.slug}`}
                  class="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-80"
                  style="border: 1px solid var(--border); background: var(--bg); color: var(--text); text-decoration: none;"
                >
                  <span style="color: var(--accent); font:12px monospace;">▶</span>
                  <span class="text-sm">{fig.title}</span>
                </a>
              </div>
            );
```

Supprimer entièrement le bloc `{unrefFigs.length > 0 && ( <ul>...</ul> )}` (≈ 127-142).

- [ ] **Step 3 : Page figure — routes et navigation depuis les blocs**

Modify `src/pages/manuscrit/[chapterSlug]/[figSlug].astro` :

Ajouter l'import :
```ts
import { extractFigures } from '../../../lib/chapter-figures.mjs';
```

Remplacer `getStaticPaths` (≈ 14-22) par :
```ts
export async function getStaticPaths() {
  const chapters = (await getCollection('chapters')).filter(c => c.data.show);
  return chapters.flatMap(chapter => {
    const figs = extractFigures(chapter.body ?? '');
    return figs.map((fig, i) => ({
      params: { chapterSlug: chapter.slug, figSlug: fig.slug },
      props: { chapter, fig, figIndex: i, figs },
    }));
  });
}
```

Remplacer la ligne des props (≈ 24) par :
```ts
const { chapter, fig, figIndex, figs } = Astro.props;
```

Remplacer le calcul `prevFig`/`nextFig` (≈ 53-54) par :
```ts
const prevFig = figIndex > 0 ? figs[figIndex - 1] : null;
const nextFig = figIndex < figs.length - 1 ? figs[figIndex + 1] : null;
```

Dans le template, les liens préc./suiv. utilisent désormais `prevFig.slug` / `nextFig.slug` directement (≈ 124 et 133), remplacer `prevFig.slug ?? figIndex - 1` par `prevFig.slug` et `nextFig.slug ?? figIndex + 1` par `nextFig.slug`. Le reste (détection de type par lecture du JSON `fig.filename`, rendu des composants) est **inchangé**.

- [ ] **Step 4 : Build vert**

Run: `npm run build`
Expected: OK, ~20 pages, aucune erreur TypeScript. (Les routes de figures sont temporairement à 0 tant que le contenu n'est pas migré — normal.)

- [ ] **Step 5 : Commit**

```bash
git add src/content/config.ts "src/pages/manuscrit/[chapterSlug]/index.astro" "src/pages/manuscrit/[chapterSlug]/[figSlug].astro"
git commit -m "refactor(figures): consommer les blocs figure du corps

La page chapitre découpe le corps via splitBody (carte-lien à l'emplacement
du bloc, plus de unrefFigs) ; la page figure dérive routes + navigation via
extractFigures. Retrait de figures: du schéma. Le contenu est migré en Task 3.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3 : Migration du contenu (`03-resultats.md`)

**Files:**
- Modify: `src/content/chapters/03-resultats.md` (frontmatter + marqueurs)

**Interfaces:** consomme le code des Tasks 1-2.

- [ ] **Step 1 : Repérer tous les chapitres à migrer**

Run: `grep -rln '^figures:' src/content/chapters/`
Attendu : `03-resultats.md` (le seul). Si d'autres apparaissent, les migrer selon la même règle.

- [ ] **Step 2 : Remplacer chaque marqueur par son bloc**

Dans `src/content/chapters/03-resultats.md`, pour **chaque** `<!-- figure: N -->` du corps, le remplacer sur place par un bloc construit à partir de l'entrée d'index **N** du tableau `figures:` du frontmatter (mêmes `filename`/`title`/`slug`). Format exact (YAML, valeurs entre guillemets doubles) :

````
```figure
filename: "<filename de figures[N]>"
title: "<title de figures[N]>"
slug: "<slug de figures[N]>"
```
````

Exemple concret pour `<!-- figure: 0 -->` (entrée d'index 0) :
````
```figure
filename: "Traction_homogene-champ_deformation_cin.json"
title: "Figure 4.1 — Traction homogène - Champ déformation calculé par la DIC à partir des images synthétiques"
slug: "traction-homogene-champ-deformation-calcule-par-matchid"
```
````

Ne PAS modifier le texte autour (WIP utilisateur). Les marqueurs actuels (ordre du corps) : index 0, 3, 1, 2, 4, 5, 6, 7, 8, 9.

- [ ] **Step 3 : Placer la figure non référencée (index 10) en fin de chapitre**

L'entrée d'index 10 (« Figure 4.11 … ») n'a pas de marqueur. Ajouter son bloc ` ```figure ` **à la toute fin** du corps du chapitre.

- [ ] **Step 4 : Retirer le tableau `figures:` du frontmatter**

Supprimer entièrement la clé `figures:` et ses 11 entrées du frontmatter de `03-resultats.md`. Conserver les autres clés (`title`, `order`, `show`, `slug`, `description` le cas échéant).

- [ ] **Step 5 : Build**

Run: `npm run build`
Expected: OK, ~20 pages — et cette fois **11 routes de figures** régénérées.

- [ ] **Step 6 : Vérifier que toutes les URLs de figures existent (pas de lien cassé)**

Run :
```bash
CH="dist/manuscrit/validation-des-outils-numeriques-pour-le-femu"
for s in traction-homogene-champ-deformation-calcule-par-matchid \
         traction-homogene-differences-relatives-absolues-champ-deformation-calcule-par-matchid \
         traction-homogene-comparaison-differences-absolues-champ-deformation-calcule-par-matchid-et-femu \
         cisaillement-homogene-champ-deformation-calcule-par-matchid \
         cisaillement-homogene-differences-relatives-absolues-champ-deformation-calcule-par-matchid \
         eprouvette-entaillee-champ-deformation-calcule-par-matchid \
         eprouvette-entaillee-difference-absolue-champ-deformation-calcule-par-matchid \
         eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-dic \
         eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-toto \
         eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-tata ; do
  test -f "$CH/$s/index.html" && echo "OK $s" || echo "MANQUE $s"
done
```
Attendu : toutes les URLs présentes (mêmes slugs qu'avant la migration → aucun lien cassé). Note : les deux entrées partageant un `filename` (4.7/4.8) ont des `slug` distincts → deux pages.

- [ ] **Step 7 : Contrôle visuel headless (les deux contextes)**

Servir `dist/` (`python3 -m http.server`, relancer après build) et capturer, via Chrome headless (cf. plans précédents) :
- la page chapitre `.../validation-des-outils-numeriques-pour-le-femu/` → confirmer que les **cartes-liens** apparaissent inline, dans l'ordre des blocs, aux bons emplacements ;
- une page figure (un des slugs ci-dessus) → confirmer le **rendu interactif** et la navigation préc./suiv.
Lire les captures (outil Read) et confirmer.

- [ ] **Step 8 : Commit**

```bash
git add src/content/chapters/03-resultats.md
git commit -m "content(figures): migrer 03-resultats vers les blocs figure

Frontmatter figures: + marqueurs <!-- figure: N --> remplacés par des blocs
\`\`\`figure inline ; figure 4.11 placée en fin de chapitre. URLs de figures
inchangées.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Couverture du spec :**
- Module partagé `chapter-figures` (`parseFigureBlock`/`splitBody`/`extractFigures`) → Task 1. ✓
- `slug` obligatoire, erreur si absent → Task 1 Step 4 + test Step 2. ✓
- Page chapitre découpe sur blocs, carte-lien, plus d'unrefFigs → Task 2 Step 2. ✓
- Page figure routes + nav depuis les blocs, rendu inchangé → Task 2 Step 3. ✓
- Schéma sans `figures:` → Task 2 Step 1. ✓
- Migration `03-resultats.md`, fig 4.11 en fin → Task 3 Steps 2-4. ✓
- URLs inchangées (pas de lien cassé) → Task 3 Step 6. ✓
- js-yaml dépendance directe → Task 1 Step 1. ✓
- Module `.mjs` importable Astro + Node → Task 1. ✓
- Vérif pages buildées réelles (LRN-030) → Task 3 Step 7. ✓
- Préservation WIP `03-resultats.md` → Task 3 Steps 2-4 (contrainte rappelée). ✓

**Placeholders :** le code du module, du test, et des éditions de pages est fourni intégralement ; la migration donne la règle exacte + un exemple complet, les 10 autres blocs se dérivent des données présentes dans le fichier migré (pas un placeholder : la donnée vit dans le fichier).

**Cohérence des noms/types :** `FigureDecl {filename,title,slug}`, `splitBody`, `extractFigures`, `parseFigureBlock` — identiques entre module, `index.astro` et `[figSlug].astro`. `slug` toujours présent (plus de repli `?? index`).
