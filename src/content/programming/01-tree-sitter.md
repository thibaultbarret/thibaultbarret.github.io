---
title: "Grammaire Tree-sitter pour MFront/MTest"
description: "Grammaire Tree-sitter pour les langages MFront et MTest (EDF/CEA).
Permet la coloration syntaxique et l'analyse structurelle du code MFront/MTest dans les éditeurs compatibles Tree-sitter."
status: "en cours"
tags: ["Tree-sitter", "MFront", "MTest", "Grammaire", "Parsing"]
github: ""
order: 1
---

Ce projet a pour but de dotter `MFront` et `MTest` d'une grammaire Tree-sitter,
permettant ainsi une meilleure prise en charge de ces langages dans les éditeurs
de code compatibles avec Tree-sitter (comme Neovim, Atom, VsCode etc.).
Les inclusions de `C++` sont traités par injections, ce qui permet de bénéficier
de la coloration syntaxique et de l'analyse structurelle du code `C++` dans les fichiers `MFront` et `MTest`.

# MFront

Pour le moment, les mots clés des DSL **MaterialLaw**, **IsotropicPlasticMisesFlow** sont
implémentés.

# MTest
