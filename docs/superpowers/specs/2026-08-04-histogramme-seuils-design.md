# Histogramme à 3 intervalles (seuils) — design

**Date :** 2026-08-04
**Statut :** validé, prêt pour le plan d'implémentation

## Objectif

Un nouveau type de figure du manuscrit : pour un champ donné et à un instant
donné, la **fraction de points** qui tombe sous un seuil bas, entre les deux
seuils, et au-dessus d'un seuil haut. Plusieurs jeux de données se comparent sur
les mêmes trois intervalles, en barres groupées. La figure est interactive :
slider d'instant, sélecteur de composante, survol.

Cas d'usage immédiat : comparer la qualité de deux calculs de déformation
obtenus avec des tailles d'éléments différentes, en lisant directement quelle
proportion du champ reste sous le critère d'acceptabilité.

La figure est le pendant statistique du mode `cmap:"threshold"` des figures de
champ ([BDR-020]) : mêmes seuils, même convention de bornes, donc la carte et
l'histogramme racontent la même chose.

## Schéma JSON

```json
{
  "histogram_seuils": true,
  "seuil_bas": "1e-4",
  "seuil_haut": "5e-4",
  "datasets": [
    { "data": "/data/…/differences_absolues_deformation_cin_ef_taille_elt_1.npy",
      "name": "\\text{taille d'élément 1}", "color": "#4e87e5", "hatch": false },
    { "data": "/data/…/differences_absolues_deformation_cin_ef_taille_elt_2.npy",
      "name": "\\text{taille d'élément 2}", "hatch": true }
  ],
  "fields_config": [
    { "index": 0, "name": "\\varepsilon_{\\mathrm{xx}}" },
    { "index": 1, "name": "\\varepsilon_{\\mathrm{yy}}" }
  ],
  "y_label": "\\text{Fraction de points}",
  "x_labels": ["< seuil bas", "entre seuils", "> seuil haut"]
}
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `histogram_seuils` | oui | Drapeau de type, testé par la route (`=== true`) |
| `seuil_bas`, `seuil_haut` | oui | Les deux bornes. Nombre **ou** chaîne (`"1e-4"`) |
| `datasets` | oui, ≥ 1 | Liste ordonnée des jeux comparés |
| `datasets[].data` | oui | Chemin du `.npy`, forme `(N, F, S)` ou `(N, S)` |
| `datasets[].name` | oui | Nom affiché en légende et au survol. **Toujours** rendu par KaTeX en mode mathématique (`renderTex`) : la prose doit être enveloppée dans `\text{…}`, sous peine de s'afficher en italique de variable |
| `datasets[].color` | non | Couleur du jeu ; défaut = palette, dans l'ordre de déclaration |
| `datasets[].hatch` | non | `true` → rayures à 45° sur les trois barres du jeu. Défaut `false` |
| `fields_config` | non | Composantes sélectionnables ; défaut `[{index:0,name:"Champ"}]` |
| `y_label` | non | **Toujours** rendu par KaTeX en mode mathématique ; défaut `\text{Fraction de points}`. Une prose non enveloppée dans `\text{…}` s'affiche en italique de variable |
| `x_labels` | non | Les trois étiquettes de groupe ; défaut construit à partir des seuils formatés |
| `legend_position` | non | `"bottom"` (défaut) ou `"right"` — légende sous le tracé ou sur son flanc droit |
| `legend_columns` | non | Nombre de colonnes de la légende, borné `[1, nb de jeux]`. Absent → une ligne repliée en bas, une colonne unique à droite |

**Pourquoi `seuil_bas`/`seuil_haut` et pas `min`/`max`.** `vmin`/`vmax` existent
déjà dans le JSON de l'histogramme classique avec un tout autre sens (cadrage de
l'axe x, cf. `histogram-runtime.ts`) ; `min`/`max` s'y confondraient. Les noms
retenus sont exactement ceux du mode seuils des champs ([BDR-020]) — même
concept, mêmes clés.

**Coercition.** Les deux seuils passent par le même `parseBound` que les bornes
actuelles : nombre ou chaîne numérique, non-fini rejeté ([LRN-026]).

## Modèle de données et calcul

**Convention de bornes**, identique à `applyThresholdLut` :

| Intervalle | Condition | Couleur du champ correspondante |
|---|---|---|
| 0 | `v < seuil_bas` | vert |
| 1 | `seuil_bas ≤ v < seuil_haut` | orange |
| 2 | `v ≥ seuil_haut` | rouge |

**Normalisation par jeu.** Les trois fractions d'un jeu somment à 1, calculées
sur les points *de ce jeu*. Deux jeux issus de maillages de tailles différentes
restent donc comparables.

**NaN.** Les valeurs non finies ne sont ni comptées ni comprises dans le
dénominateur — cohérent avec le traitement des zones non corrélées ([BDR-022])
et avec `histogramCounts`, qui ignore déjà le non-fini. (Les fichiers de la
figure de démonstration contiennent 8 points NaN sur 25 152.)

**Ce qui est partagé entre jeux :** les seuils, `fields_config`, la position du
slider. Les jeux doivent donc avoir le même nombre d'instants et porter les
composantes déclarées. En revanche un **nombre de points différent** d'un jeu à
l'autre est licite — c'est précisément ce que la normalisation par jeu rend
comparable.

**Fonction pure ajoutée à `histogram-math.ts` :**

```ts
// Fractions normalisées [< sBas, [sBas, sHaut), >= sHaut]. NaN et non-finis
// ignorés (ni comptés ni au dénominateur). Somme = 1, ou [0,0,0] si aucun point
// fini. Bornes alignées sur applyThresholdLut (vtk-core.ts).
export function thresholdCounts(
  values: ArrayLike<number>, sBas: number, sHaut: number,
): [number, number, number]
```

Aucun import runtime, comme le reste du fichier → exécutable directement dans
Node.

## Rendu

**Forme.** Barres groupées : 3 groupes (les intervalles) × N barres (les jeux).
Axe x catégoriel — les trois groupes à pas régulier, largeurs égales. C'est le
choix explicite contre un axe de valeurs réel, où les deux intervalles
extérieurs sont non bornés : leur largeur serait arbitraire et la lecture des
hauteurs trompeuse (aire ≠ effectif). Les trois bandes égales reprennent en
outre le rendu de la colorbar `threshold` des champs.

**Axe y** fixe de 0 à 1, affiché en pourcentage. Il ne se recalibre pas d'un
instant à l'autre : sinon les hauteurs sautent pendant la lecture et la
comparaison temporelle est perdue.

**Palette par défaut**, six emplacements, ordre fixe, jamais cyclé :

```
#4e87e5  #cf6912  #099f8f  #9f6dd4  #ab8309  #d25b80
 bleu     pêche    teal     mauve    jaune    rouge
```

Teintes Catppuccin Mocha, luminosité et chroma redescendus dans la bande du mode
sombre. Les accents Catppuccin bruts (`#89b4fa`, `#fab387`, …) **échouent** le
validateur de la skill dataviz contre le fond `#1e1e2e` — calibrés pour du texte
clair, ils sont trop clairs en aplat (L ≈ 0,77–0,92 pour une bande cible
0,48–0,67) et deux d'entre eux passent sous le plancher de chroma. La palette
retenue passe les cinq contrôles calculés :

```
# depuis le répertoire de la skill dataviz
node scripts/validate_palette.js "#4e87e5,#cf6912,#099f8f,#9f6dd4,#ab8309,#d25b80" \
     --mode dark --surface "#1e1e2e"
→ bande de luminosité PASS · plancher de chroma PASS
  séparation CVD PASS (pire paire adjacente ΔE 10,6 deutan, cible 8)
  plancher vision normale PASS (ΔE 18,8) · contraste sur fond PASS (tous ≥ 3:1)
```

Un septième jeu n'invente pas une teinte : il demande une autre figure, ou des
couleurs explicites.

**Hachures.** `hatch: true` superpose au remplissage des rayures à 45°, via un
`createPattern` canvas dans le hook `draw`. Booléen volontairement : plein ou
hachuré. Des motifs nommés (`"diagonal" | "horizontal" | …`) s'ajouteront sans
casser le booléen le jour où trois jeux devront se distinguer sans couleur.

**Géométrie des marques.** Barres jointives dans un groupe, séparées par 2 px de
fond ; bordure 1 px comme l'histogramme existant. Le **creux entre deux groupes
vaut toujours la largeur d'une barre** : la part du pas d'axe occupée par un
groupe est `N / (N + 1)` pour `N` jeux — 0,50 à un seul jeu, 0,67 à deux, 0,857
à six. La règle s'adapte donc au nombre de jeux dans les deux sens : une barre
unique ne s'élargit pas absurdement, et le creux ne se referme jamais quand les
jeux se multiplient. Étiquettes de groupe à la place des graduations numériques.

**Placement de la légende.** Sous le tracé par défaut. `legend_position: "right"`
la déplace dans une troisième colonne de la grille hôte, à côté du tracé, et
`legend_columns` fixe son nombre de colonnes — six entrées tiennent ainsi en 3×2
sous le graphique, ou en 2×3 sur le flanc. La disposition est posée par le
**runtime** et non dans le composant, parce qu'elle dépend d'une config chargée à
l'exécution (même raison que la grille de panneaux de [BDR-023]) ; le canvas se
redimensionne seul via son `ResizeObserver` ([LRN-021]).

**Identité des séries.** Légende présente dès deux jeux : pastille de couleur,
motif si hachuré, nom en encre de texte (jamais en couleur de série). L'identité
n'est donc jamais portée par la seule couleur.

**Survol.** Tooltip par barre : nom du jeu, intervalle, pourcentage.

**Contrôles.** Slider d'instant avec ⏮ ⏪ ▶ ⏩ ⏭, graduations `datalist` et
compteur — miroir exact de `Histogram.astro`. Sélecteur de composante affiché
seulement si `fields_config` en compte plus d'une, noms rendus par KaTeX.

## Découpage

| Fichier | Nature | Rôle |
|---|---|---|
| `src/scripts/histogram-math.ts` | modifié | Ajout de `thresholdCounts` |
| `src/scripts/histogram-seuils-runtime.ts` | créé | Chargement, état, dessin, légende, contrôles |
| `src/components/HistogramSeuils.astro` | créé | Markup, styles, init paresseuse |
| `src/pages/manuscrit/[chapterSlug]/[figSlug].astro` | modifié | Détection du type + rendu |
| `scripts/verify-histogram-seuils.mjs` | créé | Vérification Node de `thresholdCounts` |
| `public/figures/manuscrit/histogram_seuils_taille_elt.json` | créé | Figure de démonstration |

Le runtime charge les `.npy` en parallèle via `fetchNpy` de `vtk-core.ts` et
formate avec `formatValue` ; le rendu KaTeX des noms réutilise `renderTex` de
`plot1d-runtime.ts`, comme le fait déjà `histogram-runtime.ts`.

**Détection dans la route.** Un test `json.histogram_seuils === true` en tête de
la chaîne, avant `histogram`, et une branche de rendu de plus. Les autres
branches ne bougent pas.

**Non retenu :** faire de ce mode une branche du `Histogram` existant (deux
modèles de données, deux axes et deux routines de dessin dans un fichier qui en
ferait dès lors deux choses) ; extraire au préalable un socle commun de
contrôles de lecture (bénéfice réel seulement au troisième histogramme — à
reconsidérer alors).

## Erreurs

Toutes affichées dans le panneau d'erreur de la figure, pas en console :

| Cas | Message |
|---|---|
| `datasets` absent ou vide | « aucun jeu de données déclaré » |
| `seuil_bas ≥ seuil_haut`, ou seuil non numérique | rappel des deux valeurs lues |
| Nombres d'instants divergents entre jeux | nomme les fichiers et leurs tailles |
| Composante déclarée absente d'un `.npy` | nomme la composante et le fichier |
| Échec de chargement d'un `.npy` | nomme le fichier |

Cas dégradé qui n'est **pas** une erreur : un jeu dont tous les points sont NaN
à l'instant courant → trois barres à zéro, nom grisé en légende, le reste de la
figure continue de fonctionner.

## Vérification

**`scripts/verify-histogram-seuils.mjs`** (même forme que
`verify-threshold-lut.mjs`), sur `thresholdCounts` :

1. Répartition connue à la main → fractions exactes attendues.
2. Points exactement sur un seuil : `v = seuil_bas` tombe dans l'intervalle 1,
   `v = seuil_haut` dans l'intervalle 2 — la convention de la LUT des champs.
3. NaN et infinis exclus du dénominateur (somme des fractions = 1).
4. Jeu entièrement NaN → `[0, 0, 0]`, pas de division par zéro.
5. Jeu constant, et jeu entièrement d'un côté d'un seuil → une barre à 1.

**Vérification visuelle en navigateur headless** sur la figure de démonstration :
trois barres franches pour les deux jeux, hachures visibles sur le second,
légende correcte, slider et sélecteur de composante fonctionnels. Puis lecture
croisée avec la figure de champ en mode `threshold` sur les mêmes seuils : les
deux doivent concorder.

## Figure de démonstration

`public/figures/manuscrit/histogram_seuils_taille_elt.json`, deux jeux réels de
forme identique `(25152, 6, 50)` :

- `differences_absolues_deformation_cin_ef_taille_elt_1.npy`
- `differences_absolues_deformation_cin_ef_taille_elt_2.npy`

(dans `public/data/Validation_outil_calcul_deformation_formalisme_cin_locale/Eprouvette_notched/`)

Seuils de départ `1e-4` et `5e-4` — sur la dernière image, composante ε_xx, les
quantiles valent p33 ≈ 1,05e-4 / p66 ≈ 2,82e-4 pour la taille 1 et
p33 ≈ 1,28e-4 / p66 ≈ 3,42e-4 pour la taille 2. Ces bornes donnent donc trois
barres non dégénérées pour les deux jeux, la taille 2 décalée vers la droite.
Valeurs à ajuster selon le critère d'acceptabilité retenu dans le manuscrit.

## Hors périmètre

- Seuils différents selon la composante (une seule paire globale, décidé).
- Motifs de hachures nommés (booléen seulement).
- Plus de six jeux sans couleurs explicites.
- Toute modification de l'histogramme classique existant.
