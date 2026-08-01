---
title: "Validation des outils numériques pour le FEMU"
order: 4
show: True
slug: validation-des-outils-numeriques-pour-le-femu
---

# Introduction du chapitre

Ce chapitre traite de la validation des outils numériques développés pour la méthode FEMU pour les besoins de mes travaux de thèse.
Plusieurs outils ont été développés :

- Un outil pour réaliser l'alignement des données expérimentales et du maillage éléments finis.
- Un outil pour extraire les conditions aux limites expérimentales réelles à partir des déplacements mesurés par la CIN.
- Un outil pour calculer les déformations en utilisant le formalisme de la CIN-locale en utilisant le déplacement calulé par le solveur éléments finis.
- Un outil pour réaliser l'identification inverse en utilisant une méthode locale de type Quasi-Newton.

L'ensemble de ces outils sont implémentés dans un module python nommé `ONII`. Il est développé selon le paradigme de programmation orienté objet et s'appuie sur les
bibliothèques scientifiques classiques telles que `numpy`, `scipy`, `pandas` et `matplotlib`.

<!-- # Méthode d'alignement et extraction des conditions aux limites -->

# Méthode du calcul des déformations par le formalisme de la CIN-locale

## Introduction

La validation et l'influence de cet outil est réalisée dans un espace purement numérique. Le module `FEDEF` de `MatchID` permet à partir du maillage et du champ de déplacement calculé par un solveur éléments finis de déformer
une image de référence. Ceci permet de créer une expérience synthétique. La corrélation d'images numérique peut ensuite être appliquée sur ces dites images, permettant d'obtenir un champ de déplacement et de déformation calculé par le CIN-locale.
De ce fait, des conditions "quasi-expérimentales" sont reproduites tout en maitrisant la totalité des paramètres.

## Validation sur sollicitation homogène

La validation de l'outil de calcul des déformations par le formalisme de la CIN-locale est réalisée sur des sollicitations homogènes de traction et de cisaillement.
L'objectif est de comparer le champ de déformation calculé par la CIN-locale, en l'occurrence par le logiciel `MatchID` `Stereo` et le champ de déformation calculé par l'outil `StrainLeveling` en utilisant :

- les coordonnées des _subsets_ exprimées dans le repère de la caméra maître,
- les déplacements des _subsets_ exprimés dans le repère de la caméra maître.

À partir de ces données, l'outil `StrainLeveling` se charge de :

- déterminer le repère local et d'en déduire la matrice de passage
- exprimer les coordonnées des _subsets_ inclus dans le \_Strain Window_dans ce repère local
- exprimer les déplacements associés dans le repère local
- identifier les polynômes
- calculer le tenseur gradient de la transformation et le tenseur de déformation désiré.

Pour que l'implémentation numérique soit validée, l'outil `StrainLeveling` doit permettre de calculer les mêmes champs de déformation que ceux calculés par le logiciel `MatchID`, à la précision près des données manipulées.

### Génération des expériences synthétiques

Le calcul éléments finis est réalisé avec Abaqus®, un unique élément CPS4R de dimension unitaire est utilisé.
La loi de comportement est élastique linéaire isotrope avec un module d'Young de 210 GPa et un coefficient de Poisson de 0.3.
Les images sont déformées en utilisant le dispositif virtuel renseigné dans le tableau ..

| Paramètre             | Valeur                                        |
| --------------------- | --------------------------------------------- |
| Résolution de l'image | 1200 x 1200 $ \bigl[ \mathrm{px}^{2} \bigr] $ |
| Type de motif         | Points noirs aléatoire sur fond blanc         |
| Taille des points     | 4 $ \bigl[ \mathrm{px}\bigr] $                |
| Item1.3               | Item2.3                                       |
| Item1.4               | Item2.4                                       |

Les champs de cinématique sont calculés avec `MatchID` `Stereo` en utilisant les paramètres renseignés dans le tableau ... permettant d'obtenir respectivement les champs de déformations présentés sur les figures 4.1 et 4.2.

```figure
filename: "Traction_homogene-champ_deformation_cin.json"
title: "Figure 4.1 — Traction homogène - Champ déformation calculé par la DIC à partir des images synthétiques"
slug: "traction-homogene-champ-deformation-calcule-par-matchid"
```

```figure
filename: "Cisaillement_homogene-champ_deformation_cin.json"
title: "Figure 4.2 — Cisaillement homogène - Champ déformation calculé la DIC à partir des images synthétiques"
slug: "cisaillement-homogene-champ-deformation-calcule-par-matchid"
```

Les champs de déformations obtenus sont homogènes et les états de déformations correspondent à ceux attendus pour les chargements appliqués.
Les

### Comparaison des champs de déformation calculés par la CIN-locale et par l'outil `StrainLeveling`

```figure
filename: "Traction_homogene-Differences_relatives_absolues_deformation_cin_sl_u_cin.json"
title: "Figure 4.3 — Traction homogène - Différences relatives absolues champ déformation calculé la DIC à partir des images synthétiques"
slug: "traction-homogene-differences-relatives-absolues-champ-deformation-calcule-par-matchid"
```

```figure
filename: "Cisaillement_homogene-Differences_relatives_absolues_deformation_cin_sl_u_cin.json"
title: "Figure 4.4 — Cisaillement homogène - Différences relatives absolues champ déformation calculé la DIC à partir des images synthétiques"
slug: "cisaillement-homogene-differences-relatives-absolues-champ-deformation-calcule-par-matchid"
```

## Éprouvette entaillée

### Génération de l'expérience synthétique

```figure
filename: "Eprouvette_notched-champ_deformation_cin.json"
title: "Figure 4.5 — Éprouvette entaillée - Champ déformation calculé par la DIC à partir des images synthétiques"
slug: "eprouvette-entaillee-champ-deformation-calcule-par-matchid"
```

### Comparaison des champs de déformation calculés par la CIN-locale et par l'outil `StrainLeveling`

```figure
filename: "Eprouvette_notched-differences_absolues_champ_deformation_cin_sl_u_cin.json"
title: "Figure 4.7 — Éprouvette entaillée - Différence absolue du champ déformation calculé par la DIC à partir des images synthétiques"
slug: "eprouvette-entaillee-difference-absolue-champ-deformation-calcule-par-matchid"
```

```figure
filename: "histogram.json"
title: "Figure 4.9 — Éprouvette entaillée - Histogramme des différences absolues du champ de déformation calculé par la DIC à partir des images synthétiques et du champ de déformation calculé par la classe StrainLeveling à partir du déplacement DIC"
slug: "eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-dic"
```

```figure
filename: "Eprouvette_notched-differences_absolues_champ_deformation_cin_ef_et_cin_sl_u_ef.json"
title: "Figure 4.11 — Éprouvette entaillée - test 2"
slug: "eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-tata"
```

<!-- ```figure -->
<!---->
<!-- ``` -->

<!-- title: "Figure 4.3 — Traction homogène - Comparaison des différences absolues du champ de déformation calculé par la DIC à partir des images synthétiques et du champ de déformation calculé par le FEMU" -->
<!-- filename: "Traction_homogene-Comparaison_differences_absolues-cin_sl_u_ef-cin_ef.json" -->
<!-- slug: "traction-homogene-comparaison-differences-absolues-champ-deformation-calcule-par-matchid-et-femu" -->

<!-- - filename: "Cisaillement_homogene-Differences_relatives_absolues_deformation_cin_sl_u_cin.json" -->
<!-- title: "Figure 4.5 — Cisaillement homogène - Différences relatives absolues champ déformation calculé la DIC à partir des images synthétiques" -->
<!-- slug: "cisaillement-homogene-differences-relatives-absolues-champ-deformation-calcule-par-matchid"  -->

<!-- filename: "Eprouvette_notched-differences_absolues_champ_deformation_cin_sl_u_cin.json" -->
<!-- title: "Figure 4.8 — Éprouvette entaillée - Différence absolue du champ déformation calculé par la DIC à partir des images synthétiques" -->
<!-- slug: "eprouvette-entaillee-difference-absolue-champ-deformation-calcule-par-matchid" -->

<!-- filename: "Eprouvette_notched-differences_absolues_champ_deformation_cin_sl_u_ef.json" -->
<!-- title: "Figure 4.10 — Éprouvette entaillée - test" -->
<!-- slug: "eprouvette-entaillee-differences-absolues-champ-deformation-calcule-par-dic-et-strainleveling-deplacement-toto" -->
