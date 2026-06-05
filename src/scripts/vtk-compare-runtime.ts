// src/scripts/vtk-compare-runtime.ts
// Runtime de VtkFigureCompare : N panneaux 2D, LUT/colorbar/contrôles partagés,
// caméras synchronisées. Voir docs/superpowers/specs/2026-06-05-vtk-figure-compare-design.md
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow   from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkMapper                from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor                 from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPlaneSource           from '@kitware/vtk.js/Filters/Sources/PlaneSource';
import vtkPolyData              from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkDataArray             from '@kitware/vtk.js/Common/Core/DataArray';
import vtkPoints                from '@kitware/vtk.js/Common/Core/Points';
import vtkCellArray             from '@kitware/vtk.js/Common/Core/CellArray';
import vtkInteractorStyleManipulator         from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkPointPicker                          from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkMouseCameraTrackballPanManipulator   from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator  from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import {
  CMAPS, fetchNpy, idx, buildPositions, buildScalars, fieldRange, makeCells,
  toTexture, frameToTexture, formatValue, configureLut, drawColorbar,
  resolveStepText, stepHasText,
} from './vtk-core';
import type { NpyArray, RawData, StepText, ColorbarEls } from './vtk-core';

type FieldDef = { index: number; name: string };
interface PanelCfg {
  title?: string; coords: string; triangles: string; fields: string;
  displacements?: string; images?: string;
}
interface StepCfg { step: number; image?: string; image_index?: number; text?: StepText }

// État runtime d'un panneau (un render window par panneau)
interface Panel {
  cfg: PanelCfg;
  rw: any; renderer: any; renWin: any; cam: any; canvasEl: HTMLElement;
  raw: RawData; images: NpyArray | null;
  pd: any; pts: any; scalarsArr: any; meshActor: any; meshMapper: any;
  bgActor: any; imgH: number; cameraInit: boolean;
  texCache: Map<string, { tex: any; w: number; h: number }>;
  tooltip: HTMLElement;
}

export async function initCompare(container: HTMLElement): Promise<void> {
  const cfg = await fetch(container.dataset.src!).then(r => r.json());

  const fieldsConfig: FieldDef[] = cfg.fields_config
    ?? [{ index: cfg.field_index ?? 0, name: cfg.field_name ?? 'Field' }];
  const { cmap = 'RdYlGn_r', n_colors = 10, opacity = 0.8,
          label_format = '.2e', label_color = '#a6adc8' } = cfg;
  const hasFixedRange = typeof cfg.vmin === 'number' && typeof cfg.vmax === 'number';
  const steps: StepCfg[] = cfg.steps ?? [{ step: 0 }];
  const panelsCfg: PanelCfg[] = cfg.panels ?? [];
  const cmapStops = CMAPS[cmap] ?? CMAPS['viridis'];

  const panelsRow = container.querySelector<HTMLElement>('.vtkc-panels')!;

  // LUT unique partagée par tous les mappers
  const lut = vtkColorTransferFunction.newInstance();

  // ── Construire les panneaux ───────────────────────────────────────────
  const panels: Panel[] = [];
  for (const pcfg of panelsCfg) {
    // DOM du panneau : conteneur + titre overlay + tooltip
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1; position:relative; overflow:hidden; min-width:0;';
    const canvasEl = document.createElement('div');
    canvasEl.style.cssText = 'position:absolute; inset:0; overflow:hidden;';
    const titleEl = document.createElement('span');
    titleEl.textContent = pcfg.title ?? '';
    titleEl.style.cssText = 'position:absolute;top:8px;left:10px;z-index:10;color:#cdd6f4;font:12px monospace;background:rgba(24,24,37,.7);padding:2px 6px;border-radius:3px;pointer-events:none;';
    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'display:none;position:absolute;pointer-events:none;z-index:30;background:rgba(24,24,37,.92);border:1px solid #45475a;border-radius:4px;padding:3px 7px;color:#cdd6f4;font:11px monospace;white-space:nowrap;';
    wrap.append(canvasEl, titleEl, tooltip);
    panelsRow.appendChild(wrap);

    // Charger les .npy du panneau
    const [coordsArr, triArr, fieldsArr, dispArr, imagesArr] = await Promise.all([
      fetchNpy(pcfg.coords), fetchNpy(pcfg.triangles), fetchNpy(pcfg.fields),
      pcfg.displacements ? fetchNpy(pcfg.displacements) : Promise.resolve(null),
      pcfg.images ? fetchNpy(pcfg.images) : Promise.resolve(null),
    ]);
    const raw: RawData = { coords: coordsArr, triangles: triArr, fields: fieldsArr, disp: dispArr };

    // Renderer
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    const rw = vtkGenericRenderWindow.newInstance();
    rw.setContainer(canvasEl);
    rw.resize();
    const renderer = rw.getRenderer();
    renderer.setBackground(0.118, 0.118, 0.173);
    const renWin = rw.getRenderWindow();

    const iStyle = vtkInteractorStyleManipulator.newInstance();
    iStyle.addMouseManipulator(vtkMouseCameraTrackballPanManipulator.newInstance({ button: 1 }));
    iStyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 }));
    iStyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ scrollEnabled: true, dragEnabled: false }));
    rw.getInteractor().setInteractorStyle(iStyle);

    // PolyData
    const pd = vtkPolyData.newInstance();
    const pts = vtkPoints.newInstance();
    pts.setData(new Float32Array(raw.coords.shape[0] * 3), 3);
    pd.setPoints(pts);
    const polys = vtkCellArray.newInstance();
    polys.setData(makeCells(raw));
    pd.setPolys(polys);
    const scalarsArr = vtkDataArray.newInstance({ name: 'field', values: new Float32Array(raw.coords.shape[0]), numberOfComponents: 1 });
    pd.getPointData().setScalars(scalarsArr);

    const meshMapper = vtkMapper.newInstance();
    meshMapper.setInputData(pd);
    meshMapper.setLookupTable(lut);
    meshMapper.setScalarVisibility(true);
    const meshActor = vtkActor.newInstance();
    meshActor.setMapper(meshMapper);
    meshActor.getProperty().setOpacity(opacity);
    meshActor.getProperty().setLighting(false);
    renderer.addActor(meshActor);

    // Hauteur de référence (flip vertical) : max y des coords (raffiné si image)
    let dataH = 1;
    for (let i = 0; i < raw.coords.shape[0]; i++) {
      const y = idx(raw.coords.data, raw.coords.shape, i, 1);
      if (y > dataH) dataH = y;
    }

    const cam = renderer.getActiveCamera();
    cam.setParallelProjection(true);

    panels.push({
      cfg: pcfg, rw, renderer, renWin, cam, canvasEl, raw, images: imagesArr,
      pd, pts, scalarsArr, meshActor, meshMapper,
      bgActor: null, imgH: dataH, cameraInit: false,
      texCache: new Map(), tooltip,
    });
  }

  // ── Colorbar partagée ─────────────────────────────────────────────────
  const cbEls: ColorbarEls = {
    title:  container.querySelector<HTMLElement>('.vtkc-cb-title')!,
    canvas: container.querySelector<HTMLCanvasElement>('.vtkc-cb-canvas')!,
    labels: container.querySelector<HTMLElement>('.vtkc-cb-labels')!,
  };

  // ── Rendu partagé ─────────────────────────────────────────────────────
  let currentStep = -1;
  let currentFieldIdx = fieldsConfig[0].index;
  const currentScalars: Float32Array[] = [];

  async function updatePanelBackground(p: Panel, st: StepCfg) {
    let texInfo: { tex: any; w: number; h: number } | null = null;
    if (st.image) {
      if (!p.texCache.has(st.image)) p.texCache.set(st.image, await toTexture(st.image));
      texInfo = p.texCache.get(st.image)!;
    } else if (p.images) {
      const frame = st.image_index ?? st.step;
      const key = `npy#${frame}`;
      if (!p.texCache.has(key)) p.texCache.set(key, frameToTexture(p.images, frame));
      texInfo = p.texCache.get(key)!;
    }
    if (texInfo) {
      const { tex, w, h } = texInfo;
      if (!p.bgActor) {
        p.imgH = h;
        const plane = vtkPlaneSource.newInstance();
        plane.setOrigin(0, h, -1); plane.setPoint1(w, h, -1); plane.setPoint2(0, 0, -1); plane.update();
        const pm = vtkMapper.newInstance(); pm.setInputConnection(plane.getOutputPort());
        p.bgActor = vtkActor.newInstance(); p.bgActor.setMapper(pm);
        p.renderer.addActor(p.bgActor);
        p.cam.setPosition(w/2, h/2, 10); p.cam.setFocalPoint(w/2, h/2, 0);
        p.cam.setViewUp(0, 1, 0); p.cam.setParallelScale(h/2);
        p.cameraInit = true;
      }
      p.bgActor.getTextures().forEach((t: any) => p.bgActor.removeTexture(t));
      p.bgActor.addTexture(tex);
      p.bgActor.setVisibility(true);
      p.meshActor.getProperty().setOpacity(opacity);
    } else {
      if (p.bgActor) p.bgActor.setVisibility(false);
      p.meshActor.getProperty().setOpacity(1); // scène opaque, cf. LRN-014
    }
  }

  async function render(stepPos: number, fieldIdx: number) {
    const st = steps[stepPos];

    // 1) Fonds + scalaires de chaque panneau, et union des bornes
    currentScalars.length = 0;
    let vmin = Infinity, vmax = -Infinity;
    for (const p of panels) {
      const prevImgH = p.imgH;
      await updatePanelBackground(p, st);
      if (st.step !== currentStep || p.imgH !== prevImgH) {
        p.pts.setData(buildPositions(p.raw, st.step, p.imgH), 3);
        p.pts.modified(); p.pd.modified();
      }
      const sc = buildScalars(p.raw, st.step, fieldIdx);
      currentScalars.push(sc);
      const [a, b] = fieldRange(sc);
      if (a < vmin) vmin = a;
      if (b > vmax) vmax = b;
    }
    if (hasFixedRange) { vmin = cfg.vmin; vmax = cfg.vmax; }
    if (!isFinite(vmin) || !isFinite(vmax)) { vmin = 0; vmax = 1; }
    currentStep = st.step;

    // 2) LUT + colorbar (une fois)
    configureLut(lut, cmapStops, n_colors, vmin, vmax);
    const fieldName = fieldsConfig.find(f => f.index === fieldIdx)?.name ?? String(fieldIdx);
    drawColorbar(cbEls, fieldName, cmapStops, vmin, vmax, n_colors, label_format, label_color);

    // 3) Appliquer scalaires + range à chaque panneau, puis rendre
    panels.forEach((p, k) => {
      const sc = currentScalars[k];
      for (let i = 0; i < sc.length; i++) if (!isFinite(sc[i])) sc[i] = vmin;
      p.scalarsArr.setData(sc);
      p.scalarsArr.modified(); p.pd.modified();
      p.meshMapper.setScalarRange(vmin, vmax);
      if (!p.cameraInit) { p.renderer.resetCamera(); p.cameraInit = true; }
      p.renWin.render();
    });

    currentFieldIdx = fieldIdx;
  }

  // Exposer l'état pour les tâches suivantes (contrôles, sync caméra, tooltip)
  (container as any).__compare = {
    panels, steps, fieldsConfig, render,
    label_format, n_colors, opacity,
    state: () => ({ currentStep, currentFieldIdx }),
  };

  // Premier rendu
  await render(0, fieldsConfig[0].index);
  container.querySelector<HTMLElement>('.vtkc-loading')!.style.display = 'none';

  // Réajuste tous les render windows au resize du conteneur
  new ResizeObserver(() => {
    panels.forEach(p => { p.rw.resize(); p.renWin.render(); });
  }).observe(container);
}
