# Format court des JSON de figure — design

**Date :** 2026-11-20
**Statut :** validé le 2026-11-20

## Objectif

L'auteur écrit **à la main** les JSON de figure de `public/figures/manuscrit/`.
Les chemins sont trop longs : chaque fichier répète le même dossier `/data/…`
sur chaque clé, et les figures animées listent un chemin d'image complet par
pas (50 entrées pour l'éprouvette entaillée). Demande : « Les chemins que je
spécifie sont trop longs, il faudrait pouvoir les scinder. »

Constat sur les 14 JSON actuels : **dans chaque fichier, tous les chemins sont
dans un seul dossier**. Pour les pas, trois cas existent : image numérotée
(`…_step_{pas+1}.png`), image fixe pour tous les pas (`…_step_0.png`), et texte
de statistiques propre à chaque pas.

## Buts

1. **Dossier commun** : clé `dossier` ; tout chemin relatif (sans `/` initial)
   est résolu dans ce dossier. Un objet imbriqué (panneau de comparaison, jeu
   de données d'histogramme, maillage `dic`/`fe` en 3D) peut déclarer son propre
   `dossier`, qui remplace celui du parent pour lui et ses enfants.
2. **Modèle d'image de pas** : clé `image_pas` au premier niveau. Jetons
   `{pas}` (valeur de `step`) et `{pas+1}`. Sans jeton : même image pour tous
   les pas. Appliqué aux pas qui n'ont pas leur propre `image` ; résultat
   ensuite résolu par `dossier`.
3. **Nombre de pas** : `"steps": N` (entier ≥ 1) équivaut à
   `[{ "step": 0 }, …, { "step": N-1 }]`. La forme liste reste valable (utile
   pour `text` par pas) ; ses entrées n'ont plus besoin d'`image`.
4. **Compatibilité totale** : un chemin commençant par `/`, `http://`,
   `https://` ou `data:` est laissé tel quel ; un JSON sans `dossier` ni
   `image_pas` se comporte exactement comme avant.
5. **Conversion des 14 JSON existants** au format court, sans changement de
   rendu.
6. **Erreur claire** : un chemin relatif sans `dossier` applicable, un
   `steps` numérique invalide ou un `image_pas` sans `steps` → message
   d'erreur affiché dans la figure (mécanismes d'erreur existants), qui nomme
   la clé fautive.

## Non-buts

- Détection des fautes de frappe sur les clés, schéma JSON complet, type de
  figure explicite : hors périmètre (pistes évoquées, non retenues ici).
- Bloc ```` ```figure ```` des chapitres (`filename`, `title`, `slug`) : inchangé.
- `scripts/export_figure.py` : il produit un autre format (`.vtp` par pas)
  qu'aucune figure actuelle n'utilise ; pas touché.
- Plusieurs dossiers nommés dans une même figure (approche 2, écartée).

## Anti-buts

- Casser une figure existante, ou un JSON écrit à l'ancien format.
- Une résolution différente selon le type de figure (2D, 3D, comparaison,
  champ+courbe, courbe 1D, histogramme, histogramme à seuils).

## Approches envisagées

1. **Dossier commun + noms courts** — *retenue par l'auteur.* Colle aux
   fichiers réels (un dossier par figure), ne casse rien.
2. Plusieurs dossiers nommés (`"cin:deformations.npy"`) — écartée : aucune
   figure ne mélange plusieurs dossiers, syntaxe de plus à retenir.
3. **Modèle d'image de pas** — *retenue en complément par l'auteur* : c'est ce
   qui rend les fichiers longs.

## Conception

### Où se fait la résolution

Une seule fonction pure, `normalizeFigureConfig(cfg)`, dans un nouveau module
sans import `src/scripts/figure-config.ts`, renvoie une **nouvelle**
configuration à l'ancien format (chemins absolus, `steps` en liste, `image`
dans chaque pas). Une fonction `loadFigureConfig(url)` du même module fait
`fetch` + contrôle du statut HTTP + `normalizeFigureConfig`. Les sept
chargements de configuration actuels l'utilisent :
`VtkFigure.astro`, `VtkFigure3D.astro`, `vtk-compare-runtime.ts`,
`field-curve-runtime.ts`, `plot1d-runtime.ts`, `histogram-runtime.ts`,
`histogram-seuils-runtime.ts`. Le reste du code des figures ne change pas.

Le build (`src/pages/manuscrit/[chapterSlug]/[figSlug].astro`) lit aussi les
JSON pour deviner le type de figure ; il ne lit aucun chemin ni `steps`, donc
n'a pas besoin de la normalisation (à vérifier par le constructeur).

### Clés de chemin résolues

Valeurs **chaînes** des clés `coords`, `triangles`, `triangulation`,
`connectivity`, `fields`, `displacements`, `images`, `image`, `data`, `x`, `y`,
à n'importe quelle profondeur. Les autres clés (dont `text`, `name`, `title`)
ne sont jamais touchées. Jointure : `dossier` sans `/` final + `/` + valeur.

### Ordre d'application

1. `steps` numérique → liste.
2. `image_pas` → `image` des pas qui n'en ont pas.
3. Résolution des chemins relatifs par `dossier` (héritage parent → enfant).
4. Les clés `dossier` et `image_pas` sont retirées du résultat.

### Conversion des JSON existants

Script ponctuel (non conservé) qui, pour chaque JSON : extrait le dossier
commun en `dossier`, raccourcit les chemins, remplace les images de pas par
`image_pas` quand elles suivent `{pas}`, `{pas+1}` ou sont constantes, et
réduit `steps` à un entier quand les entrées ne contiennent plus que
`step` consécutif depuis 0. **Garde-fou** : pour chaque fichier,
`normalizeFigureConfig(nouveau)` doit être égal en profondeur à l'ancien JSON
(ordre des clés mis à part) ; sinon le fichier n'est pas réécrit.
Indentation de 4 espaces comme aujourd'hui.

### Décisions complémentaires (choix de Claude, après relecture)

- **`dossier` relatif** : un `dossier` imbriqué sans `/` initial est joint à
  celui du parent (`"dossier": "panneau_a"` dans un panneau). Un `dossier` de
  premier niveau sans `/` initial est une erreur (il serait sinon résolu par
  rapport à l'URL de la page et échouerait en silence).
- **`image_pas` + pile `images` (.npy)** : combinaison refusée avec une
  erreur claire, car une `image` de pas masque déjà la frame npy.
- **Conversion sans écraser un travail en cours** : le script refuse de
  réécrire un JSON qui a des modifications non commitées (`git status`) et le
  signale ; la conversion fait l'objet d'un commit séparé du code, proposé à
  l'auteur.

### Documentation

Le commentaire de schéma en tête de `VtkFigure.astro` décrit `dossier`,
`image_pas` et `steps` numérique, avec un exemple court.

## Vérification

- `scripts/verify-figure-config.mjs` (convention du dépôt, import direct du
  `.ts`) : jointure simple, chemin absolu inchangé, `http`/`data:` inchangés,
  héritage et remplacement de `dossier` dans un panneau, `{pas}`, `{pas+1}`,
  image fixe, `image` propre d'un pas prioritaire, `steps: 3`, `text` préservé,
  `dossier` imbriqué relatif joint au parent, erreurs (relatif sans dossier,
  `dossier` de premier niveau relatif, `steps: 0`, `image_pas` sans `steps`,
  `image_pas` avec `images`), objet
  d'entrée non modifié, et pour les 14 JSON du dépôt : aucun chemin relatif
  après normalisation.
- `npm run build` sans erreur.
- Dans le navigateur : la figure 2D 4.5 et la comparaison 4.11 s'affichent
  comme avant (images de fond comprises), plus un histogramme.

## Laissé au constructeur

- Noms internes, découpage du module.
- Forme exacte des messages d'erreur (en français, nommant la clé).
