#!/bin/bash
# Compile les fichiers .tex de equations/ en SVG dans public/equations/
# Usage : ./scripts/build-equations.sh
#         ./scripts/build-equations.sh nom-fichier  (un seul fichier)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$ROOT_DIR/equations"
OUT_DIR="$ROOT_DIR/public/equations"
TMP_DIR="$(mktemp -d)"

# Nettoyage automatique du dossier temporaire à la sortie
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$OUT_DIR"

# Copier le préambule dans le dossier temporaire
cp "$SRC_DIR/preamble.tex" "$TMP_DIR/"

compile_one() {
    local texfile="$1"
    local name
    name=$(basename "$texfile" .tex)

    echo "→ $name"

    # Copier dans le dossier temporaire
    cp "$texfile" "$TMP_DIR/"

    # Compiler avec pdflatex depuis $TMP_DIR pour que \input{preamble} soit trouvé
    (cd "$TMP_DIR" && pdflatex \
        -interaction=nonstopmode \
        -halt-on-error \
        "$name.tex" \
        > /dev/null 2>&1) || {
            echo "  ✗ Erreur pdflatex — relance avec log visible :"
            (cd "$TMP_DIR" && pdflatex -interaction=nonstopmode "$name.tex")
            return 1
        }

    # Convertir PDF → SVG (glyphes en chemins vectoriels, pas de dépendance fonte)
    dvisvgm \
        --pdf \
        --exact-bbox \
        --no-fonts \
        --output="$OUT_DIR/$name.svg" \
        "$TMP_DIR/$name.pdf" \
        > /dev/null 2>&1 || {
            echo "  ✗ Erreur dvisvgm"
            return 1
        }

    echo "  ✓ public/equations/$name.svg"
}

if [ -n "$1" ]; then
    # Compilation d'un seul fichier
    target="$SRC_DIR/$1.tex"
    if [ ! -f "$target" ]; then
        echo "Fichier introuvable : $target"
        exit 1
    fi
    compile_one "$target"
else
    # Compilation de tous les fichiers (sauf preamble.tex)
    count=0
    for texfile in "$SRC_DIR"/*.tex; do
        [ "$(basename "$texfile")" = "preamble.tex" ] && continue
        compile_one "$texfile"
        ((count++))
    done
    echo ""
    echo "$count équation(s) compilée(s) → public/equations/"
fi
