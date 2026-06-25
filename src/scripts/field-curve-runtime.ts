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
  CMAPS, fetchNpy, idx, buildPositions, buildScalars, fieldRange, makeCells,
  toTexture, frameToTexture, formatValue, configureLut, drawColorbar,
} from './vtk-core';
import type { NpyArray, RawData, ColorbarEls } from './vtk-core';
import uPlot from 'uplot';
import { extractColumn, alignSeries, loadAxis, renderTex, PALETTE } from './plot1d-runtime';
import type { CurveConfig } from './plot1d-runtime';

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
          label_format = '.2e', label_color = '#a6adc8' } = cfg;
  const hasFixedRange = typeof cfg.vmin === 'number' && typeof cfg.vmax === 'number';
  const steps: StepCfg[] = cfg.steps ?? [{ step: 0 }];
  const cmapStops = CMAPS[cmap] ?? CMAPS['viridis'];

  // ── CHAMP (un panneau, adapté de vtk-compare-runtime.ts single-panel) ──
  const canvasEl = el.querySelector<HTMLElement>('.fc-canvas')!;

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
  renderer.setBackground(0.118, 0.118, 0.173);
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
  let currentFieldIdx = fieldsConfig[0].index;

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
        cam.setViewUp(0, 1, 0); cam.setParallelScale(h/2);
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
    if (hasFixedRange) { vmin = cfg.vmin; vmax = cfg.vmax; }
    if (!isFinite(vmin) || !isFinite(vmax)) { vmin = 0; vmax = 1; }
    currentStep = st.step;

    configureLut(lut, cmapStops, n_colors, vmin, vmax);
    const fieldName = fieldsConfig.find(f => f.index === fieldIdx)?.name ?? String(fieldIdx);
    drawColorbar(cbEls, fieldName, cmapStops, vmin, vmax, n_colors, label_format, label_color);

    for (let i = 0; i < sc.length; i++) if (!isFinite(sc[i])) sc[i] = vmin;
    scalarsArr.setData(sc);
    scalarsArr.modified(); pd.modified();
    meshMapper.setScalarRange(vmin, vmax);
    if (!cameraInit) { renderer.resetCamera(); cameraInit = true; }
    renWin.render();

    currentFieldIdx = fieldIdx;
  }

  // ── Contrôles (récupérés AVANT goTo pour éviter tout TDZ sur slider/label) ──
  const controls = el.querySelector<HTMLElement>('.fc-controls')!;
  const slider   = el.querySelector<HTMLInputElement>('.fc-slider')!;
  const label    = el.querySelector<HTMLElement>('.fc-label')!;
  const playBtn  = el.querySelector<HTMLButtonElement>('.fc-play')!;
  const firstBtn = el.querySelector<HTMLButtonElement>('.fc-first')!;
  const prevBtn  = el.querySelector<HTMLButtonElement>('.fc-prev')!;
  const nextBtn  = el.querySelector<HTMLButtonElement>('.fc-next')!;
  const lastBtn  = el.querySelector<HTMLButtonElement>('.fc-last')!;
  let animTimer: ReturnType<typeof setInterval> | null = null;
  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; playBtn.textContent = '▶'; } }

  const fieldsDiv = el.querySelector<HTMLElement>('.fc-fields')!;
  let sliderPos = 0;

  // ── Point d'extension pour la Task 2 (marqueur sur la courbe) ───────────
  let onStep: (i: number) => void = () => {};

  async function goTo(pos: number) {
    sliderPos = Math.max(0, Math.min(pos, steps.length - 1));
    const p = sliderPos;
    label.textContent = `${p + 1}/${steps.length}`;
    slider.value = String(p);
    await renderField(p, currentFieldIdx);
    onStep(p);
  }

  // ── Sélecteur de champ partagé (adapté l.285-302) ───────────────────────
  if (fieldsConfig.length > 1) {
    fieldsDiv.style.display = 'flex';
    fieldsConfig.forEach(({ index, name }) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.dataset.idx = String(index);
      const active = index === fieldsConfig[0].index;
      btn.style.cssText = `padding:3px 10px;font:11px monospace;border-radius:4px;cursor:pointer;border:1px solid #45475a;background:${active?'#89b4fa':'#313244'};color:${active?'#1e1e2e':'#cdd6f4'};`;
      btn.addEventListener('click', async () => {
        stopAnim();
        fieldsDiv.querySelectorAll('button').forEach(b => { b.style.background = '#313244'; b.style.color = '#cdd6f4'; });
        btn.style.background = '#89b4fa'; btn.style.color = '#1e1e2e';
        currentFieldIdx = index;
        await renderField(sliderPos, index);
      });
      fieldsDiv.appendChild(btn);
    });
  }

  // ── Slider de pas partagé (adapté l.304-324) ────────────────────────────
  const hasSteps = steps.length > 1;
  if (hasSteps) {
    controls.style.display = 'flex';
    slider.max = String(steps.length - 1);
    const datalist = el.querySelector<HTMLDataListElement>('.fc-datalist')!;
    const listId = 'fc-dl-' + Math.random().toString(36).slice(2);
    datalist.id = listId; slider.setAttribute('list', listId);
    for (let i = 0; i < steps.length; i++) { const opt = document.createElement('option'); opt.value = String(i); datalist.appendChild(opt); }
    slider.addEventListener('input', () => { stopAnim(); goTo(parseInt(slider.value)); });
    firstBtn.addEventListener('click', () => { stopAnim(); goTo(0); });
    prevBtn.addEventListener('click',  () => { stopAnim(); goTo(sliderPos - 1); });
    nextBtn.addEventListener('click',  () => { stopAnim(); goTo(sliderPos + 1); });
    lastBtn.addEventListener('click',  () => { stopAnim(); goTo(steps.length - 1); });
    playBtn.addEventListener('click', () => {
      if (animTimer) stopAnim();
      else { playBtn.textContent = '⏸'; animTimer = setInterval(() => goTo((sliderPos + 1) % steps.length), 200); }
    });
  }

  // ── Premier rendu ─────────────────────────────────────────────────────
  await goTo(0);
  el.querySelector<HTMLElement>('.fc-loading')!.style.display = 'none';

  new ResizeObserver(() => {
    rw.resize();
    renWin.render();
  }).observe(el.querySelector<HTMLElement>('.fc-field')!);

  // ── Bouton reset (adapté l.372-381, un seul panneau) ────────────────────
  const resetBtn = el.querySelector<HTMLButtonElement>('.fc-reset')!;
  resetBtn.style.display = 'block';
  resetBtn.addEventListener('click', () => {
    renderer.resetCamera();
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
        tooltip.textContent = formatValue(val, label_format);
        tooltip.style.display = 'block';
        const rect = canvasEl.getBoundingClientRect();
        tooltip.style.left = `${Math.min(cssX + 12, rect.width - 90)}px`;
        tooltip.style.top  = `${Math.max(cssY - 28, 4)}px`;
        return;
      }
    }
    tooltip.style.display = 'none';
  });

  // ── COURBE 1D (uPlot + helpers plot1d) ──
  const curvesCfg: CurveConfig[] = cfg.curves ?? [];
  if (curvesCfg.length === 0) throw new Error('Aucune courbe : le champ `curves` est vide ou absent.');
  const markerOffset = Number.isInteger(cfg.marker_offset) ? cfg.marker_offset : 0;
  const markerColor: string = cfg.marker_color ?? '#f38ba8';

  // Tableaux ORIGINAUX (x,y) par courbe — servent au marqueur (indice = pas+offset)
  const loaded = await Promise.all(curvesCfg.map(async (c, i) => {
    const label = c.label ?? `Série ${i + 1}`;
    const index = c.index ?? 0;
    const yNpy = await fetchNpy(c.y);
    const y = extractColumn(yNpy, yNpy.shape.length >= 2 ? index : 0);
    const x = await loadAxis(c.x ?? cfg.x, index);
    if (x == null) throw new Error(`Courbe « ${label} » : aucun axe x (ni propre, ni racine).`);
    if (x.length !== y.length) throw new Error(`Courbe « ${label} » : x (${x.length}) et y (${y.length}) de longueurs différentes.`);
    return { x, y, label, color: c.color ?? PALETTE[i % PALETTE.length], width: c.width ?? 2, dash: c.dash };
  }));

  const cData = alignSeries(loaded.map(s => ({ x: s.x, y: s.y }))) as uPlot.AlignedData;

  renderTex(el.querySelector<HTMLElement>('.fc-c-title'), cfg.title, false);
  renderTex(el.querySelector<HTMLElement>('.fc-c-xlabel'), cfg.xlabel, false);
  renderTex(el.querySelector<HTMLElement>('.fc-c-ylabel-inner'), cfg.ylabel, true);

  const cMount = el.querySelector<HTMLElement>('.fc-c-uplot')!;
  const legendH = () => cMount.querySelector<HTMLElement>('.u-legend')?.offsetHeight ?? 0;
  const cSize = () => ({ width: cMount.clientWidth, height: Math.max(80, cMount.clientHeight - legendH()) });

  // Indice du marqueur (mis à jour par onStep) ; clamp + warn si hors borne
  let markerIdx = 0;
  function setMarker(stepPos: number) {
    const raw = stepPos + markerOffset;
    markerIdx = raw;
    if (loaded.some(s => raw < 0 || raw >= s.x.length))
      console.warn(`[fieldcurve] marqueur ${raw} hors borne pour au moins une courbe (clampé au rendu).`);
  }

  const uOpts: uPlot.Options = {
    ...cSize(),
    scales: { x: { time: false, distr: (cfg.xlog ? 3 : 1) as 1 | 3 }, y: { distr: (cfg.ylog ? 3 : 1) as 1 | 3 } },
    axes: [
      { stroke: '#cdd6f4', grid: { stroke: '#313244' }, ticks: { stroke: '#45475a' }, font: '11px monospace' },
      { stroke: '#cdd6f4', grid: { stroke: '#313244' }, ticks: { stroke: '#45475a' }, font: '11px monospace' },
    ],
    series: [ {}, ...loaded.map(s => ({ label: s.label, stroke: s.color, width: s.width, dash: s.dash, spanGaps: true, points: { show: false } })) ],
    cursor: { drag: { x: true, y: false } },
    legend: { show: cfg.legend !== false },
    hooks: {
      draw: [ (u: any) => {
        const ctx = u.ctx; ctx.save();
        for (const s of loaded) {
          const k = Math.max(0, Math.min(markerIdx, s.x.length - 1));
          const xv = s.x[k], yv = s.y[k];
          if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
          const cx = u.valToPos(xv, 'x', true), cy = u.valToPos(yv, 'y', true);
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
          ctx.fillStyle = markerColor; ctx.strokeStyle = '#1e1e2e'; ctx.lineWidth = 2;
          ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      } ],
    },
  };
  const u = new uPlot(uOpts, cData, cMount);
  if (cfg.legend !== false) {
    const rows = cMount.querySelectorAll<HTMLElement>('.u-legend .u-series');
    loaded.forEach((s, i) => {
      const row = rows[i + 1];
      const cell = row?.querySelector<HTMLElement>('.u-label') ?? (row?.lastElementChild as HTMLElement | null);
      if (cell) renderTex(cell, s.label, false);
    });
  }
  u.setSize(cSize());
  new ResizeObserver(() => u.setSize(cSize())).observe(cMount);

  // Brancher le marqueur sur le slider partagé : à chaque pas, recalcul + redraw
  onStep = (pos: number) => { setMarker(pos); u.redraw(); };
  setMarker(sliderPos);   // aligne le marqueur sur le pas initial déjà rendu
  u.redraw();
}
