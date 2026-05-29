import meshio
import numpy as np

# Grille 2D (spécimen 50×30 mm)
nx, ny = 50, 30
x = np.linspace(0, 50, nx)
y = np.linspace(0, 30, ny)
xx, yy = np.meshgrid(x, y)

points = np.column_stack([xx.ravel(), yy.ravel(), np.zeros(nx * ny)])

# Connectivité quads
cells = []
for j in range(ny - 1):
    for i in range(nx - 1):
        p0 = j * nx + i
        cells.append([p0, p0 + 1, p0 + nx + 1, p0 + nx])
cells = np.array(cells)

# Champs (remplacer par tes données DIC)
eps_xx = np.sin(xx.ravel() / 8) * 0.01
eps_yy = np.cos(yy.ravel() / 6) * 0.008
u_x = np.cumsum(eps_xx.reshape(ny, nx), axis=1).ravel() * 0.1

mesh = meshio.Mesh(
    points=points,
    cells=[("quad", cells)],
    point_data={
        "eps_xx": eps_xx,
        "eps_yy": eps_yy,
        "u_x": u_x,
    },
)
mesh.write("public/figures/manuscrit/champ-dic.vtu")
