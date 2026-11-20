// src/scripts/field-curve-runtime.ts
// Runtime de FieldCurve : un champ 2D (helpers vtk-core) + une courbe 1D (helpers
// plot1d-runtime) pilotés par un slider commun, avec marqueur mobile sur la courbe.
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
  CMAPS, fetchNpy, idx, buildPositions, buildScalars, fieldRange, makeCells, cellsWithoutNaN,
  toTexture, frameToTexture, formatValue, configureLut, drawColorbar,
  limitZoomOut,
} from './vtk-core';
import { createPlayer } from './vtk-player';
import type { NpyArray, RawData, ColorbarEls } from './vtk-core';

type FieldDef = { index: number; name: string };
interface StepCfg { step: number; image?: string; image_index?: number }

export async function initFieldCurve(el: HTMLElement): Promise<void> {
  const cfg = await fetch(el.dataset.src!).then(r => {
    if (!r.ok) throw new Error(`Config introuvable : ${el.dataset.src} (${r.status})`);
    return r.json();
  });

  const fieldsConfig: FieldDef[] = cfg.fields_config
    ?? [{ index: cfg.field_index ?? 0, name: cfg.field_name ?? 'Field' }];
  const { cmap = 'RdYlGn_r', n_colors = 10, opacity = 0.8,
          label_format = '.2e', label_color = '#a6adc8', scale = 'linear' } = cfg;
  // Format de la valeur au survol du champ (tooltip). Défaut : label_format (colorbar).
  const tooltip_format = cfg.tooltip_format ?? label_format;
  const log = scale === 'log';
  const hasFixedRange = typeof cfg.vmin === 'number' && typeof cfg.vmax === 'number';
  const steps: StepCfg[] = cfg.steps ?? [{ step: 0 }];
  const cmapStops = CMAPS[cmap] ?? CMAPS['viridis'];

  // ── CHAMP (un panneau, adapté de vtk-compare-runtime.ts single-panel) ──
  const canvasEl = el.querySelector<HTMLElement>('.fc-canvas')!;
  const logErrEl = el.querySelector<HTMLElement>('.fc-log-error')!;

  // Charger les .npy (adapté de vtk-compare-runtime.ts l.107-112)
  const [coordsArr, triArr, fieldsArr, dispArr, imagesArr] = await Promise.all([
    fetchNpy(cfg.coords), fetchNpy(cfg.triangles), fetchNpy(cfg.fields),
    cfg.displacements ? fetchNpy(cfg.displacements) : Promise.resolve(null),
    cfg.images ? fetchNpy(cfg.images) : Promise.resolve(null),
  ]);
  const raw: RawData = { coords: coordsArr, triangles: triArr, fields: fieldsArr, disp: dispArr };
  const images: NpyArray | null = imagesArr;

  // Renderer + interacteur (adapté de vtk-compare-runtime.ts l.114-127)
  await new Promise<void>(r => requestAnimationFrame(() => r()));
  const rw = vtkGenericRenderWindow.newInstance();
  rw.setContainer(canvasEl);
  rw.resize();
  const renderer = rw.getRenderer();
  renderer.setBackground(0.067, 0.067, 0.106); // #11111b, fond du cadre
  const renWin = rw.getRenderWindow();

  const iStyle = vtkInteractorStyleManipulator.newInstance();
  iStyle.addMouseManipulator(vtkMouseCameraTrackballPanManipulator.newInstance({ button: 1 }));
  iStyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 }));
  iStyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ scrollEnabled: true, dragEnabled: false }));
  rw.getInteractor().setInteractorStyle(iStyle);

  // PolyData + mapper + actor + LUT (adapté de vtk-compare-runtime.ts l.129-148)
  const lut = vtkColorTransferFunction.newInstance();
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

  // Hauteur de référence (flip vertical) : max y des coords (adapté l.150-155)
  let imgH = 1;
  for (let i = 0; i < raw.coords.shape[0]; i++) {
    const y = idx(raw.coords.data, raw.coords.shape, i, 1);
    if (y > imgH) imgH = y;
  }

  const cam = renderer.getActiveCamera();
  cam.setParallelProjection(true);
  const zoom = limitZoomOut(renderer, cam); // dé-zoom borné à MAX_ZOOM_OUT × vue de référence

  let cameraInit = false;
  let bgActor: any = null;
  const texCache = new Map<string, { tex: any; w: number; h: number }>();

  // ── Colorbar ─────────────────────────────────────────────────────────
  const cbEls: ColorbarEls = {
    title:  el.querySelector<HTMLElement>('.fc-cb-title')!,
    canvas: el.querySelector<HTMLCanvasElement>('.fc-cb-canvas')!,
    labels: el.querySelector<HTMLElement>('.fc-cb-labels')!,
  };

  // ── Rendu ──────────────────────────────────────────────────────────────
  let currentStep = -1;

  // updatePanelBackground (l.179-211) → renommé updateBackground (un seul panneau)
  async function updateBackground(st: StepCfg) {
    let texInfo: { tex: any; w: number; h: number } | null = null;
    if (st.image) {
      if (!texCache.has(st.image)) texCache.set(st.image, await toTexture(st.image));
      texInfo = texCache.get(st.image)!;
    } else if (images) {
      const frame = st.image_index ?? st.step;
      const key = `npy#${frame}`;
      if (!texCache.has(key)) texCache.set(key, frameToTexture(images, frame));
      texInfo = texCache.get(key)!;
    }
    if (texInfo) {
      const { tex, w, h } = texInfo;
      if (!bgActor) {
        imgH = h;
        const plane = vtkPlaneSource.newInstance();
        plane.setOrigin(0, h, -1); plane.setPoint1(w, h, -1); plane.setPoint2(0, 0, -1); plane.update();
        const pm = vtkMapper.newInstance(); pm.setInputConnection(plane.getOutputPort());
        bgActor = vtkActor.newInstance(); bgActor.setMapper(pm);
        renderer.addActor(bgActor);
        cam.setPosition(w/2, h/2, 10); cam.setFocalPoint(w/2, h/2, 0);
        cam.setViewUp(0, 1, 0); cam.setParallelScale(h/2); zoom.mark();
        cameraInit = true;
      }
      bgActor.getTextures().forEach((t: any) => bgActor.removeTexture(t));
      bgActor.addTexture(tex);
      bgActor.setVisibility(true);
      meshActor.getProperty().setOpacity(opacity);
    } else {
      if (bgActor) bgActor.setVisibility(false);
      meshActor.getProperty().setOpacity(1); // scène opaque, cf. LRN-014
    }
  }

  // render(stepPos, fieldIdx) (l.213-259) réduit à un panneau, SANS la zone texte
  async function renderField(stepPos: number, fieldIdx: number) {
    const st = steps[stepPos];

    const prevImgH = imgH;
    await updateBackground(st);
    if (st.step !== currentStep || imgH !== prevImgH) {
      pts.setData(buildPositions(raw, st.step, imgH), 3);
      pts.modified(); pd.modified();
    }
    const sc = buildScalars(raw, st.step, fieldIdx);
    let [vmin, vmax] = fieldRange(sc);
    const dataMin = vmin; // min non-NaN AVANT substitution de plage forcée
    if (log && !(dataMin > 0)) {
      const fieldName = fieldsConfig.find(f => f.index === fieldIdx)?.name ?? String(fieldIdx);
      logErrEl.textContent =
        `⚠ Échelle logarithmique impossible : le champ « ${fieldName} » contient des valeurs ≤ 0 (min = ${formatValue(dataMin, label_format)}).`;
      logErrEl.style.display = 'flex';
      return;
    }
    logErrEl.style.display = 'none';
    if (hasFixedRange) { vmin = cfg.vmin; vmax = cfg.vmax; }
    if (log && !(vmin > 0)) {
      logErrEl.textContent =
        `⚠ Échelle logarithmique impossible : la borne inférieure forcée (vmin = ${formatValue(vmin, label_format)}) doit être strictement positive.`;
      logErrEl.style.display = 'flex';
      return;
    }
    if (!isFinite(vmin) || !isFinite(vmax)) { vmin = 0; vmax = 1; }
    currentStep = st.step;

    configureLut(lut, cmapStops, n_colors, vmin, vmax, log);
    const fieldName = fieldsConfig.find(f => f.index === fieldIdx)?.name ?? String(fieldIdx);
    drawColorbar(cbEls, fieldName, cmapStops, vmin, vmax, n_colors, label_format, label_color, log);

    polys.setData(cellsWithoutNaN(raw, sc));
    polys.modified();
    scalarsArr.setData(sc);
    scalarsArr.modified(); pd.modified();
    meshMapper.setScalarRange(vmin, vmax);
    if (!cameraInit) { zoom.reset(); cameraInit = true; }
    renWin.render();

  }

  let sliderPos = 0;
  // Marqueur de la courbe : branché plus bas, une fois le <Plot1D> initialisé.
  let onStep: (i: number) => void = () => {};

  async function render(stepPos: number, fieldIdx: number) {
    await renderField(stepPos, fieldIdx);
    sliderPos = stepPos;
    onStep(stepPos);
  }

  // ── Barre de lecture commune + premier rendu (rejette si échec → .fc-error) ──
  await createPlayer(el.querySelector<HTMLElement>('.vp-bar')!, {
    steps: steps.length, fields: fieldsConfig, render,
  });
  el.querySelector<HTMLElement>('.fc-loading')!.style.display = 'none';

  new ResizeObserver(() => {
    rw.resize();
    renWin.render();
  }).observe(el.querySelector<HTMLElement>('.fc-field')!);

  // ── Bouton reset (adapté l.372-381, un seul panneau) ────────────────────
  el.querySelector<HTMLButtonElement>('.fc-reset')!.addEventListener('click', () => {
    zoom.reset();
    renWin.render();
  });

  // ── Tooltip de valeur (adapté l.384-410, un seul panneau) ───────────────
  const tooltip = el.querySelector<HTMLElement>('.fc-tooltip')!;
  const picker = vtkPointPicker.newInstance();
  picker.setTolerance(0.01);
  let cssX = 0, cssY = 0;
  canvasEl.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = canvasEl.getBoundingClientRect();
    cssX = e.clientX - rect.left; cssY = e.clientY - rect.top;
  });
  canvasEl.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  rw.getInteractor().onMouseMove((callData: any) => {
    const pos = callData.position;
    picker.pick([pos.x, pos.y, 0], renderer);
    const ptId = picker.getPointId();
    if (ptId >= 0 && ptId < scalarsArr.getNumberOfTuples()) {
      const val = scalarsArr.getValue(ptId);
      if (isFinite(val)) {
        tooltip.textContent = formatValue(val, tooltip_format);
        tooltip.style.display = 'block';
        const rect = canvasEl.getBoundingClientRect();
        tooltip.style.left = `${Math.min(cssX + 12, rect.width - 90)}px`;
        tooltip.style.top  = `${Math.max(cssY - 28, 4)}px`;
        return;
      }
    }
    tooltip.style.display = 'none';
  });

  // ── COURBE : pilotage du marqueur du <Plot1D> embarqué ─────────────────
  // La courbe est rendue par le composant <Plot1D> (robuste). Il expose
  // `__plot1d.setMarker(i)` une fois initialisé ; on attend cette API puis on
  // branche le slider du champ dessus (marqueur à `pas + marker_offset`).
  const markerOffset = Number.isInteger(cfg.marker_offset) ? cfg.marker_offset : 0;
  const plotEl = el.querySelector<HTMLElement>('.plot1d-figure');
  if (plotEl) {
    const wire = () => {
      const api = (plotEl as any).__plot1d as { setMarker(i: number): void } | undefined;
      if (!api) { requestAnimationFrame(wire); return; }
      onStep = (pos: number) => api.setMarker(pos + markerOffset);
      api.setMarker(sliderPos + markerOffset); // sync sur le pas courant
    };
    wire();
  }
}
