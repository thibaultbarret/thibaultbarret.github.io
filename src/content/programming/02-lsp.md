---
title: "LSP pour MFront/MTest"
description: "Serveur de langage (Language Server Protocol) pour MFront et MTest. Apporte la complétion, la navigation et le diagnostic en temps réel dans les éditeurs compatibles LSP (VS Code, Neovim, etc.)."
status: "en cours"
tags: ["LSP", "MFront", "MTest", "Language Server", "Neovim", "VS Code"]
github: ""
order: 2
---

Ce projet a pour but de développer un serveur de langage (Language Server Protocol - LSP) pour les langages `MFront` et `MTest`.
Le LSP permettra d'apporter des fonctionnalités telles que la complétion de code, la navigation dans le code et le diagnostic en temps réel dans les éditeurs compatibles LSP comme `Neovim`, etc.
L'objectif est d'améliorer l'expérience de développement pour les utilisateurs de `MFront` et `MTest` en fournissant des outils d'aide à la programmation et de détection
d'erreurs directement dans leur éditeur de code préféré.

# Fonctionnalités

## Complétions de code

L'ensemble des mots clé de `MTest` ont été implémentés. Pour chaque mot clé, un snippet de code est proposé pour faciliter l'écriture du code `MTest`.

## Diagnostic en temps réel

### Diagnostic de syntaxe

Le LSP analyse en temps réel le code `MFront` et `MTest` pour détecter les erreurs de syntaxe.
Il fournit des diagnostics précis sur les erreurs de syntaxe, les problèmes de structure et les incohérences dans le code.

### Diagnostic des injections de `C++`

Certains mots clés de `MFront` sont suivis d'une injection de code `C++` (ex: `code{...}`).
Le LSP délègue l'analyse de ce code `C++` à un serveur de langage l'occurence:clangd
pour fournir des diagnostics précis sur les erreurs de syntaxe et les problèmes potentiels dans le code `C++` injecté.

# Installation

## Prérequis

- `clangd` doit être installé et accessible dans le `$PATH` du système pour que le LSP puisse déléguer l'analyse du code `C++` injecté.

## Neovim

Depuis la version 0.10 de Neovim, le support des LSP est intégré nativement. L'installation du LSP est relativement simple et peut être réalisée en quelques étapes.
Dans le dossier de configuration de Neovim se trouve généralement en `~/.config/nvim/` :

```
├── init.lua
├── lsp
│  ├── clangd.lua
│  └── mfront_lsp.lua
├── lua
│  ├── config
│  ├── core
│  │   └──lsp.lua
```

Dans le dossier `lsp/`, créer le fichier `mfront_lsp.lua` et y ajouter la configuration suivante :

```lua
return {
    cmd = {
        "<<chemin_vers_le_dossier>/.venv/bin/python3",
        "-m",
        "mfront_lsp",
    },
    filetypes = { "mfront", "mtest" },
    root_dir = function(bufnr, cb)
        cb(vim.fn.fnamemodify(vim.api.nvim_buf_get_name(bufnr), ":h"))
    end,
    -- root_markers = { ".git" },
    cmd_env = {
        PYTHONPATH = "<<chemin_vers_le_dossier>>",
    },
}

```

Le fichier lsp.lua contient la configuration générale pour les serveurs de langage. Il doit contenir les lignes suivantes pour activer les serveurs de langage `clangd` et `mfront_lsp`:

```lua
vim.lsp.enable({
    "clangd",
    "mfront_lsp",
})

```

# Exemples
