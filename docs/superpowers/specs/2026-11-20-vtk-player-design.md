# Lecteur commun des figures de champ (VtkPlayer) — design

**Date :** 2026-11-20
**Statut :** validé le 2026-11-20 (limite de dé-zoom ajoutée à la validation)

## Objectif

Les figures de champ du site (VTK 2D, VTK 3D, champ + courbe, comparaison) ont
des contrôles qui **répondent mal** et **font cheap**. Demande de l'auteur :

> « J'aimerai que la zone ou le champ est représenté soit bien distincte du
> reste, ensuite des boutons simples et élégant qui ne font pas cheap »

Le travail : un **lecteur commun** (barre de contrôle + logique de lecture)
partagé par les quatre variantes, dans le style « A — cadre encastré » choisi
sur maquette, avec le choix de composante en **menu déroulant dans la barre**.

## Diagnostic (causes réelles, pas symptômes)

1. **Clics et glissés volés par vtk.js (VtkFigure, VtkFigure3D).** Les contrôles
   (`.vtk-controls`, `.vtk-fields`, `.vtk-reset`, et `.vtk3d-*` équivalents)
   sont **à l'intérieur** du conteneur passé à `rw.setContainer(canvasEl)`
   (`VtkFigure.astro:419`, `VtkFigure3D.astro:299`). `RenderWindowInteractor`
   écoute `pointerdown` sur ce conteneur et appelle
   `container.setPointerCapture` (RenderWindowInteractor.js, `handlePointerDown`) :
   le slider perd son glissé, les boutons ratent des clics, la caméra bouge à la
   place. FieldCurve et Compare ont déjà leurs contrôles hors conteneur.
2. **Course entre rendus (les quatre variantes).** Le slider appelle `goTo` à
   chaque `input` ; `goTo` attend `render` (chargement de texture), sans
   annulation : le dernier rendu **à finir** gagne, pas le dernier **demandé**.
   Compare a une garde partielle (`pos2` figé, `vtk-compare-runtime.ts:328`).
3. **Lecture aveugle.** `setInterval(…, 200)` lance un rendu toutes les 200 ms
   quel que soit le temps de rendu : empilement, saccades.
4. **Habillage.** Boutons 24 px à emoji (⏮⏪▶⏩⏭), styles inline dupliqués
   quatre fois, slider natif `accent-color`, contrôles posés en surimpression
   sur le champ.

## Buts

- Zone du champ nettement séparée : **cadre encastré** (fond `#11111b`,
  rayon 8 px, bordure `#45475a`,
  `box-shadow: inset 0 0 0 1px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.35)`).
- **Aucun contrôle interactif dans le cadre ni dans le conteneur vtk.** Une
  seule barre **sous** le cadre (marge 10 px), de gauche à droite :
  menu de composante · ⏮ ‹ ▶ › ⏭ · slider · compteur `12 / 40` · boutons de vue
  (⟳, plus ⊡ en 3D et 🔗 en comparaison, redessinés en icônes).
- Boutons : icônes SVG au trait (style Lucide, `stroke-width` 1.8, 16 px),
  boutons 32 px transparents, survol `#313244`, focus visible `#89b4fa` ;
  lecture = rond 36 px plein accent `#89b4fa`, icône pause en lecture.
- Slider dessiné : piste 4 px, partie parcourue en accent (variable `--p`),
  pouce 14 px clair bordé 3 px accent ; Chrome/Safari et Firefox.
- Menu de composante : `<select>` stylé (fond `#181825`, bordure `#313244`,
  chevron dessiné). Libellés tels que dans `fields_config[].name` (`ε_xx`…).
- **Le dernier demandé gagne** : l'UI (slider, compteur, menu) se met à jour
  tout de suite ; le rendu suit, et un rendu périmé n'est jamais affiché par
  dessus un plus récent.
- **Lecture cadencée** : pas suivant seulement après la fin du rendu courant,
  au plus un pas toutes les 200 ms ; changer de pas ou de composante arrête la
  lecture.
- Une seule implémentation partagée par les quatre variantes.

## Non-buts

- Histogrammes (`histogram-runtime.ts`, `histogram-seuils-runtime.ts`) et
  courbes 1D (`plot1d-runtime.ts`) : pas touchés (uPlot, pas de capture vtk).
  Ils pourront adopter le lecteur plus tard.
- Format JSON des figures, rendu vtk, cartes de couleur, préchargement des pas :
  inchangés. Interaction caméra inchangée hormis la limite de dé-zoom.
- Pas de nouvelle dépendance.

## Anti-buts (échec même si « ça marche »)

- Un glissé sur le slider qui fait tourner ou déplacer la caméra.
- Un contrôle qui recouvre le champ.
- Une régression du tooltip de valeur, de la barre de couleur, du panneau de
  texte, du chargement paresseux (IntersectionObserver / `<details>`), du
  message d'erreur.
- Quatre copies divergentes du même code, comme aujourd'hui.

## Approches envisagées

1. **Lecteur commun `VtkPlayer`** — *retenue par l'auteur.* Barre, styles,
   icônes et logique de lecture écrits une fois ; chaque variante ne fournit
   que « affiche le pas n, composante c ». Corrige les causes 1 à 4 à la racine.
   Plus de travail initial, comportement et rendu identiques partout.
2. **Retouche sur place de chaque variante** — sortir les contrôles, restyler,
   ajouter la garde, quatre fois. Diff initial plus petit, mais le code reste
   en quatre exemplaires qui divergent (c'est déjà le cas : seule Compare a une
   garde).
3. *(écartée)* Contrôles en surimpression façon lecteur vidéo (maquette B) :
   rejetée sur maquette, recouvre le champ.

## Conception

### Découpage

- `src/components/VtkPlayerBar.astro` — balisage statique de la barre (menu,
  5 boutons, slider, compteur, emplacement pour boutons de vue) + sprite SVG des
  icônes + styles (classes, plus de styles inline). Inclus par les quatre
  composants, **hors** du conteneur vtk, sous le cadre.
- `src/scripts/vtk-player.ts` — comportement :
  ```ts
  createPlayer(barEl: HTMLElement, opts: {
    steps: number;                       // nombre de pas (≥ 1)
    fields: { index: number; name: string }[];
    render: (step: number, field: number) => Promise<void>;
  }): Promise<{ goTo(step: number): void; stop(): void }>  // résolue après le 1er rendu
  ```
  Contient l'ordonnanceur « dernier demandé gagne » et la boucle de lecture.
- Classe CSS du cadre (`.field-frame`) appliquée au wrapper qui contient le
  conteneur vtk et les surimpressions **non interactives** (barre de couleur,
  tooltip, chargement, erreurs), qui restent dans le cadre.

### Ordonnanceur

État : `wanted = {step, field}`, `running: boolean`.
`request(step, field)` met à jour `wanted` et l'UI ; si aucun rendu n'est en
cours, boucle `while (shown ≠ wanted) { snap = wanted; await render(snap) ;
shown = snap }`. Un rendu en échec est journalisé (`console.error`) et
n'interrompt pas la boucle. Logique pure, testable sans DOM.

### Lecture

Boucle asynchrone (pas de `setInterval`) : `t0` ; `await` du rendu du pas
suivant ; attente de `max(0, FRAME_MS − écoulé)` avec `FRAME_MS = 200` ;
boucle jusqu'à arrêt. Après le dernier pas, repart au premier (comportement
actuel). Clic sur un bouton, glissé du slider ou changement de composante →
arrêt.

### Cas limites

- 1 seul pas : boutons de lecture, slider et compteur masqués ; menu et ⟳
  restent.
- 1 seule composante (ou pas de `fields_config`) : menu masqué.
- Largeur étroite : la barre passe sur deux lignes, le slider occupe toute la
  largeur de la seconde (*choix de Claude*).
- Accessibilité : `aria-label` en français sur chaque bouton et le slider, le
  menu a un libellé ; navigation clavier native (Tab, flèches sur slider et
  menu).
- Lecture : la boucle se fige pendant le rendu en cours ; le menu de composante
  arrête la lecture (voir Décisions complémentaires).

### Par variante

| Variante | Fichier(s) | Changements |
|---|---|---|
| VTK 2D | `VtkFigure.astro` | contrôles et boutons de composante sortis du `.vtk-canvas` ; `goTo`/`setInterval`/boutons remplacés par `createPlayer` ; ⟳ dans la barre |
| VTK 3D | `VtkFigure3D.astro` | idem ; ⊡ (vue parallèle) et ⟳ dans la barre |
| Champ + courbe | `FieldCurve.astro`, `field-curve-runtime.ts` | barre sous la ligne champ+courbe ; le slider pilote aussi le marqueur de la courbe (comme aujourd'hui, via `render`) |
| Comparaison | `VtkFigureCompare.astro`, `vtk-compare-runtime.ts` | `.vtkc-fields` du haut remplacé par le menu ; 🔗 et ⟳ dans la barre ; garde `pos2` supprimée (couverte par l'ordonnanceur) |

### Limite du dé-zoom (demande de l'auteur, ajoutée après relecture)

> « Il faut aussi limiter le de-zoom maximal »

On ne peut plus dé-zoomer au-delà de **2 × la vue de référence** (vue après
`resetCamera`), donc le champ occupe toujours au moins la moitié du cadre
(*facteur 2 : choix de Claude*, constante `MAX_ZOOM_OUT = 2`).

- Projection parallèle (2D, champ + courbe, comparaison, 3D en vue ⊡) :
  `cam.getParallelScale()` borné à `MAX_ZOOM_OUT × échelle de référence`.
- Perspective (3D) : distance caméra–point focal bornée à
  `MAX_ZOOM_OUT × distance de référence`, en reculant la position le long de
  la direction de visée.
- Un seul utilitaire partagé dans `vtk-core.ts`, branché sur
  `cam.onModified` ; la référence est relevée à chaque `resetCamera`
  (premier rendu, ⟳, ⊡, changement de positions en 3D).
- Comparaison : le bornage s'applique à chaque panneau ; la synchronisation
  des caméras liées ne doit pas boucler (le bornage ne modifie la caméra que si
  la borne est dépassée).
- Pas de limite de zoom avant (non demandée).

### Décisions complémentaires (choix de Claude, après relecture)

- **Prop `height`** : garde son sens actuel dans chaque composant, pour ne
  revoir aucune page. En 2D/3D elle fixe la hauteur du cadre : la figure
  grandit de la hauteur de la barre (~46 px, deux lignes sur mobile). Dans
  FieldCurve et Compare elle fixe la figure entière : le champ rétrécit
  d'autant.
- **Portée du cadre** : un cadre par vue vtk. Compare : un cadre par panneau
  (remplace la bordure actuelle), barre de couleur partagée hors cadre, sur le
  fond de la figure. FieldCurve : cadre autour du champ seul ; la courbe uPlot
  reste sur le fond de la figure.
- **Premier rendu** : `createPlayer` renvoie une `Promise` résolue après le
  rendu du pas 0 et **rejetée** s'il échoue, pour que le `.catch` existant
  affiche toujours « Erreur VTK ». Seuls les rendus suivants sont journalisés
  sans interrompre l'ordonnanceur.
- **Panneau de texte** : ordre cadre → barre → texte, pour garder la barre
  collée au champ qu'elle pilote. Dans Compare, le texte de chaque panneau ne
  change pas de place.
- **Arrêt de la lecture** : seules les actions qui changent le pas ou la
  composante (boutons de pas, slider, menu) arrêtent la lecture. Les boutons
  de vue (⟳, ⊡, 🔗) et la manipulation de la caméra ne l'arrêtent pas : on
  peut tourner autour du champ pendant l'animation. L'API reste `goTo` / `stop`.

## Vérification

- `scripts/verify-vtk-player.mjs` (convention du dépôt) : teste l'ordonnanceur
  avec des rendus factices de durées variables — dernier demandé affiché en
  dernier, pas de rendu périmé après un plus récent, un échec ne bloque pas.
- `npm run build` sans erreur.
- Vérification manuelle dans `astro dev` sur une page de chaque variante :
  glisser le slider ne bouge pas la caméra, clic rapide sur les boutons,
  lecture fluide, changement de composante pendant la lecture, mobile (largeur
  375 px), tooltip et barre de couleur intacts ; molette arrière prolongée :
  le champ s'arrête à la moitié du cadre (2D, 3D perspective, 3D ⊡,
  comparaison liée et déliée).
- Le bornage du dé-zoom est couvert par `verify-vtk-player.mjs` (fonction
  pure : échelle/distance demandée → valeur bornée).

## Laissé au constructeur

- Tracés exacts des icônes SVG, noms de classes CSS.
- Emplacement exact du sprite SVG (une fois par page ou par barre).
- Découpage interne de `vtk-player.ts` tant que l'API ci-dessus est tenue.
