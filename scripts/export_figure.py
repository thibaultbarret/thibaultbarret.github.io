#!/usr/bin/env python3
"""
Export de figures DIC pour le site web.

Deux fonctions :
  - export_dic_figure         : figure statique (un seul pas)
  - export_dic_figure_animated: figure animée   (slider de pas de temps)

Dépendances : numpy, pyvista, Pillow
"""

import json
from pathlib import Path

import numpy as np


# ── Utilitaires ───────────────────────────────────────────────────────────────

def _load(x):
    return np.load(x) if isinstance(x, str) else np.asarray(x)


def _build_mesh(coords, displacements, triangles, fields, field_index, step_index, field_name, H):
    """Construit un PolyData PyVista pour un pas donné."""
    import pyvista as pv

    xy = coords[:, :2].copy()
    if displacements is not None:
        d = displacements[:, :2, step_index] if displacements.ndim == 3 else displacements[:, :2]
        xy += d

    # Repère VTK (origine bas-gauche)
    xy_vtk = xy.copy()
    xy_vtk[:, 1] = H - xy[:, 1]

    points = np.c_[xy_vtk[:, 0], xy_vtk[:, 1], np.zeros(len(coords))]
    faces  = np.hstack([np.full((len(triangles), 1), 3), triangles])
    mesh   = pv.PolyData(points, faces)

    if fields.ndim == 3:
        fval = fields[:, field_index, step_index]
    elif fields.ndim == 2:
        fval = fields[:, field_index]
    else:
        fval = fields.ravel()

    mesh[field_name] = fval
    mesh.set_active_scalars(field_name)
    return mesh


def _save_image(image_src, dest: Path):
    """Copie ou convertit l'image source vers dest (PNG)."""
    from PIL import Image as PILImage
    PILImage.open(image_src).convert("RGB").save(str(dest))


# ── Figure statique ───────────────────────────────────────────────────────────

def export_dic_figure(
    image: str,
    coords: "str | np.ndarray",
    triangles: "str | np.ndarray",
    fields: "str | np.ndarray",
    output_dir: str,
    figure_name: str,
    displacements: "str | np.ndarray | None" = None,
    field_index: int = 0,
    step_index: int = -1,
    field_name: str = "PEEQ",
) -> None:
    """
    Exporte un seul pas en .vtp + image de fond.

    Paramètres
    ----------
    image        : Chemin vers l'image de fond (PNG/JPG).
    coords       : (N, 2) coordonnées subsets en pixels.
    triangles    : (T, 3) indices de triangles.
    fields       : (N,), (N, F) ou (N, F, S).
    output_dir   : Dossier de sortie, ex : 'public/figures/manuscrit'.
    figure_name  : Nom de base, ex : 'champ-dic'.
    displacements: (N, 2) ou (N, 2, S) — optionnel.
    field_index  : Colonne du champ (axe 1).
    step_index   : Pas de temps (axe 2).
    field_name   : Nom du champ VTK.
    """
    from PIL import Image as PILImage

    coords    = _load(coords)
    triangles = _load(triangles).astype(int)
    fields    = _load(fields)
    disp      = _load(displacements) if displacements is not None else None

    img  = PILImage.open(image)
    _, H = img.size

    mesh = _build_mesh(coords, disp, triangles, fields, field_index, step_index, field_name, H)

    out  = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    mesh.save(str(out / f"{figure_name}.vtp"))
    _save_image(image, out / f"{figure_name}-bg.png")

    print(f"✓ {out / figure_name}.vtp")
    print(f"✓ {out / figure_name}-bg.png")
    print()
    print("Frontmatter :")
    print(f"  - filename: \"{figure_name}.vtp\"")
    print(f"    title: \"Figure — {field_name}\"")
    print(f"    image: \"{figure_name}-bg.png\"")
    print(f"    field: \"{field_name}\"")
    print(f"    cmap:  \"RdYlGn_r\"")
    print(f"    opacity: 0.8")


# ── Figure animée (slider) ────────────────────────────────────────────────────

def export_dic_figure_animated(
    images: "list[str] | str",
    coords: "str | np.ndarray",
    triangles: "str | np.ndarray",
    fields: "str | np.ndarray",
    output_dir: str,
    figure_name: str,
    displacements: "str | np.ndarray | None" = None,
    steps: "list[int] | None" = None,
    field_index: int = 0,
    field_name: str = "PEEQ",
    cmap: str = "RdYlGn_r",
    opacity: float = 0.8,
) -> None:
    """
    Exporte plusieurs pas en .vtp + images de fond → manifest JSON + slider.

    Paramètres
    ----------
    images       : Liste d'images (une par pas) ou chemin unique répété.
    coords       : (N, 2) coordonnées subsets en pixels.
    triangles    : (T, 3) indices de triangles.
    fields       : (N, F, S) champs pour tous les pas.
    output_dir   : Dossier de sortie, ex : 'public/figures/manuscrit'.
    figure_name  : Nom de base, ex : 'champ-dic'.
    displacements: (N, 2, S) — optionnel.
    steps        : Liste des indices de pas à exporter. None = tous.
    field_index  : Colonne du champ (axe 1).
    field_name   : Nom du champ VTK.
    cmap         : Colormap matplotlib.
    opacity      : Opacité du mesh.
    """
    from PIL import Image as PILImage

    coords    = _load(coords)
    triangles = _load(triangles).astype(int)
    fields    = _load(fields)
    disp      = _load(displacements) if displacements is not None else None

    n_steps = fields.shape[2] if fields.ndim == 3 else 1
    if steps is None:
        steps = list(range(n_steps))

    # Normaliser la liste d'images
    if isinstance(images, str):
        images = [images] * len(steps)
    assert len(images) == len(steps), "len(images) doit égaler len(steps)"

    # Dimensions de l'image (supposées constantes)
    _, H = PILImage.open(images[0]).size

    # Calculer vmin/vmax global pour la colormap fixe
    if fields.ndim == 3:
        all_vals = np.concatenate([fields[:, field_index, s] for s in steps])
    else:
        all_vals = fields[:, field_index] if fields.ndim == 2 else fields.ravel()
    vmin, vmax = float(all_vals.min()), float(all_vals.max())

    # Dossier des pas
    out     = Path(output_dir)
    sub     = out / figure_name            # sous-dossier pour les fichiers par pas
    sub.mkdir(parents=True, exist_ok=True)

    manifest_steps = []

    for i, (step_idx, img_path) in enumerate(zip(steps, images)):
        mesh = _build_mesh(coords, disp, triangles, fields, field_index, step_idx, field_name, H)

        vtp_file = sub / f"step-{i:03d}.vtp"
        bg_file  = sub / f"step-{i:03d}-bg.png"

        mesh.save(str(vtp_file))
        _save_image(img_path, bg_file)

        manifest_steps.append({
            "index":  step_idx,
            "vtp":   f"/figures/manuscrit/{figure_name}/step-{i:03d}.vtp",
            "image": f"/figures/manuscrit/{figure_name}/step-{i:03d}-bg.png",
        })

        print(f"  [{i+1}/{len(steps)}] pas {step_idx} → step-{i:03d}.vtp", flush=True)

    # Écrire le manifest
    manifest = {
        "type":       "vtk-animated",
        "field_name": field_name,
        "cmap":       cmap,
        "opacity":    opacity,
        "vmin":       vmin,
        "vmax":       vmax,
        "steps":      manifest_steps,
    }
    manifest_path = out / f"{figure_name}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"\n✓ Manifest → {manifest_path}")
    print(f"  {len(steps)} pas exportés dans {sub}/")
    print()
    print("Frontmatter :")
    print(f"  - filename: \"{figure_name}.json\"")
    print(f"    title: \"Figure — {field_name} (animée)\"")


# ── Exemple d'utilisation ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import glob

    BASE = "./../traction"

    # Figure statique (dernier pas)
    export_dic_figure(
        image=f"{BASE}/Images_synthetiques/synthetic_image_homogeneous_tensile_step_10.png",
        coords=f"{BASE}/coordonnees_subsets.npy",
        displacements=f"{BASE}/deplacements_cin_px.npy",
        triangles=f"{BASE}/subset_triangulation.npy",
        fields=f"{BASE}/deformations_cin.npy",
        output_dir="public/figures/manuscrit",
        figure_name="champ-dic",
        field_index=0,
        step_index=-1,
        field_name="PEEQ",
    )

    # Figure animée (tous les pas)
    all_images = sorted(glob.glob(f"{BASE}/Images_synthetiques/synthetic_image_*.png"))
    export_dic_figure_animated(
        images=all_images,
        coords=f"{BASE}/coordonnees_subsets.npy",
        displacements=f"{BASE}/deplacements_cin_px.npy",
        triangles=f"{BASE}/subset_triangulation.npy",
        fields=f"{BASE}/deformations_cin.npy",
        output_dir="public/figures/manuscrit",
        figure_name="champ-dic-anim",
        steps=None,          # tous les pas
        field_index=0,
        field_name="PEEQ",
        cmap="RdYlGn_r",
    )
