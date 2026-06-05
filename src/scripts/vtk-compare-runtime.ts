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
  resolveStepText,
} from './vtk-core';
import type { NpyArray, RawData, StepText, ColorbarEls } from './vtk-core';

type FieldDef = { index: number; name: string };

// Texte propre à un panneau : soit une légende fixe (chaîne), soit un
// dictionnaire indexé par valeur de pas (`step`), dont chaque valeur est
// elle-même un StepText (chaîne commune, ou dict indexé par index de champ).
type PanelText = string | Record<string, StepText>;
function resolvePanelText(t: PanelText | undefined, stepValue: number, fieldIdx: number): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return resolveStepText(t[String(stepValue)], fieldIdx);
}
function panelHasText(t: PanelText | undefined): boolean {
  if (t == null) return false;
  return typeof t === 'string' ? t.length > 0 : Object.keys(t).length > 0;
}

interface PanelCfg {
  title?: string; coords: string; triangles: string; fields: string;
  displacements?: string; images?: string; text?: PanelText;
}
interface StepCfg { step: number; image?: string; image_index?: number }

// État runtime d'un panneau (un render window par panneau)
interface Panel {
  cfg: PanelCfg;
  rw: any; renderer: any; renWin: any; cam: any; canvasEl: HTMLElement;
  raw: RawData; images: NpyArray | null;
  pd: any; pts: any; scalarsArr: any; meshActor: any; meshMapper: any;
  bgActor: any; imgH: number; cameraInit: boolean;
  texCache: Map<string, { tex: any; w: number; h: number }>;
  tooltip: HTMLElement; textEl: HTMLElement;
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

  // Si AU MOINS un panneau a du texte, on réserve une zone de texte de hauteur
  // FIXE et IDENTIQUE sur TOUS les panneaux (même vides) pour que les canvas
  // restent alignés et ne sautent pas au changement de pas. Hauteur réglable
  // via `text_height` (px), défaut 64.
  const anyText = panelsCfg.some(pc => panelHasText(pc.text));
  const textHeight = typeof cfg.text_height === 'number' ? cfg.text_height : 64;

  const panelsRow = container.querySelector<HTMLElement>('.vtkc-panels')!;

  // LUT unique partagée par tous les mappers
  const lut = vtkColorTransferFunction.newInstance();

  // ── Construire les panneaux ───────────────────────────────────────────
  const panels: Panel[] = [];
  for (const pcfg of panelsCfg) {
    // DOM du panneau : colonne [zone texte au-dessus] + [hôte de rendu]
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; border:1px solid #45475a; border-radius:4px;';
    // Zone texte propre au panneau, au-dessus de la figure (masquée si pas de texte)
    const textEl = document.createElement('div');
    textEl.style.cssText = 'display:none; flex-shrink:0; box-sizing:border-box; overflow-y:auto; padding:10px 12px; background:rgba(24,24,37,.95); border-bottom:1px solid #45475a; color:#cdd6f4; font:12px/1.6 sans-serif;';
    if (anyText) { textEl.style.display = 'block'; textEl.style.height = `${textHeight}px`; }
    // Hôte du rendu : relatif, contient le canvas vtk + le titre + le tooltip
    const canvasHost = document.createElement('div');
    canvasHost.style.cssText = 'flex:1; position:relative; overflow:hidden; min-height:0;';
    const canvasEl = document.createElement('div');
    canvasEl.style.cssText = 'position:absolute; inset:0; overflow:hidden;';
    const titleEl = document.createElement('span');
    titleEl.textContent = pcfg.title ?? '';
    titleEl.style.cssText = 'position:absolute;top:8px;left:10px;z-index:10;color:#cdd6f4;font:12px monospace;background:rgba(24,24,37,.7);padding:2px 6px;border-radius:3px;pointer-events:none;';
    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'display:none;position:absolute;pointer-events:none;z-index:30;background:rgba(24,24,37,.92);border:1px solid #45475a;border-radius:4px;padding:3px 7px;color:#cdd6f4;font:11px monospace;white-space:nowrap;';
    canvasHost.append(canvasEl, titleEl, tooltip);
    wrap.append(textEl, canvasHost);
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
      texCache: new Map(), tooltip, textEl,
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
    const currentScalars: Float32Array[] = [];
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

    // 3) Appliquer scalaires + range + texte à chaque panneau, puis rendre
    panels.forEach((p, k) => {
      const sc = currentScalars[k];
      for (let i = 0; i < sc.length; i++) if (!isFinite(sc[i])) sc[i] = vmin;
      p.scalarsArr.setData(sc);
      p.scalarsArr.modified(); p.pd.modified();
      p.meshMapper.setScalarRange(vmin, vmax);
      // Texte propre au panneau, suit le pas (st.step) et le champ courant
      if (p.textEl.style.display !== 'none') {
        p.textEl.innerHTML = resolvePanelText(p.cfg.text, st.step, fieldIdx);
      }
      if (!p.cameraInit) { p.renderer.resetCamera(); p.cameraInit = true; }
      p.renWin.render();
    });

    currentFieldIdx = fieldIdx;
  }

  // ── Contrôles (récupérés AVANT goTo pour éviter tout TDZ sur slider/label) ──
  const controls = container.querySelector<HTMLElement>('.vtkc-controls')!;
  const slider   = container.querySelector<HTMLInputElement>('.vtkc-slider')!;
  const label    = container.querySelector<HTMLElement>('.vtkc-label')!;
  const playBtn  = container.querySelector<HTMLButtonElement>('.vtkc-play')!;
  const firstBtn = container.querySelector<HTMLButtonElement>('.vtkc-first')!;
  const prevBtn  = container.querySelector<HTMLButtonElement>('.vtkc-prev')!;
  const nextBtn  = container.querySelector<HTMLButtonElement>('.vtkc-next')!;
  const lastBtn  = container.querySelector<HTMLButtonElement>('.vtkc-last')!;
  let animTimer: ReturnType<typeof setInterval> | null = null;
  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; playBtn.textContent = '▶'; } }

  const fieldsDiv = container.querySelector<HTMLElement>('.vtkc-fields')!;
  let sliderPos = 0;

  async function goTo(pos: number) {
    sliderPos = Math.max(0, Math.min(pos, steps.length - 1));
    const pos2 = sliderPos;                         // figé : sliderPos peut bouger pendant l'await
    label.textContent = `${pos2 + 1}/${steps.length}`;
    slider.value = String(pos2);
    await render(pos2, currentFieldIdx);
  }

  // ── Sélecteur de champ partagé ────────────────────────────────────────
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
        await render(sliderPos, index);
      });
      fieldsDiv.appendChild(btn);
    });
  }

  // ── Slider de pas partagé ─────────────────────────────────────────────
  // La barre du bas ne contient plus que le transport : visible seulement s'il
  // y a plusieurs pas (le sélecteur de champ est un overlay haut, indépendant).
  const hasSteps = steps.length > 1;
  if (hasSteps) {
    controls.style.display = 'flex';
    slider.max = String(steps.length - 1);
    const datalist = container.querySelector<HTMLDataListElement>('.vtkc-datalist')!;
    const listId = 'vtkc-dl-' + Math.random().toString(36).slice(2);
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
  container.querySelector<HTMLElement>('.vtkc-loading')!.style.display = 'none';

  new ResizeObserver(() => {
    panels.forEach(p => { p.rw.resize(); p.renWin.render(); });
  }).observe(container);

  // ── Synchronisation des caméras ───────────────────────────────────────
  let camerasLinked = true;
  let syncing = false;
  function syncFrom(src: Panel) {
    if (!camerasLinked || syncing) return;
    syncing = true;
    const pos = src.cam.getPosition();
    const fp  = src.cam.getFocalPoint();
    const up  = src.cam.getViewUp();
    const ps  = src.cam.getParallelScale();
    for (const p of panels) {
      if (p === src) continue;
      p.cam.setPosition(...pos);
      p.cam.setFocalPoint(...fp);
      p.cam.setViewUp(...up);
      p.cam.setParallelScale(ps);
      p.renderer.resetCameraClippingRange(); // cf. LRN-010
      p.renWin.render();
    }
    syncing = false;
  }
  panels.forEach(p => { p.cam.onModified(() => syncFrom(p)); });

  const linkBtn = container.querySelector<HTMLButtonElement>('.vtkc-link')!;
  linkBtn.style.display = 'block';
  function refreshLinkBtn() {
    linkBtn.textContent = camerasLinked ? '🔗' : '🚫';
    linkBtn.style.background = camerasLinked ? '#89b4fa' : '#313244';
    linkBtn.title = camerasLinked ? 'Caméras liées (cliquer pour délier)' : 'Caméras déliées (cliquer pour lier)';
  }
  refreshLinkBtn();
  linkBtn.addEventListener('click', () => {
    camerasLinked = !camerasLinked;
    refreshLinkBtn();
    if (camerasLinked && panels.length) syncFrom(panels[0]); // réaligne sur le 1er
  });

  // ── Bouton reset (tous les panneaux) ──────────────────────────────────
  const resetBtn = container.querySelector<HTMLButtonElement>('.vtkc-reset')!;
  resetBtn.style.display = 'block';
  resetBtn.addEventListener('click', () => {
    syncing = true; // éviter la cascade pendant le reset groupé
    panels.forEach(p => { p.renderer.resetCamera(); p.renWin.render(); });
    syncing = false;
    // En mode lié, réaligner toutes les caméras sur le 1er panneau pour que
    // l'état après reset soit cohérent immédiatement (et pas seulement au 1er drag).
    if (camerasLinked && panels.length) syncFrom(panels[0]);
  });

  // ── Tooltips de valeur (un par panneau) ───────────────────────────────
  panels.forEach((p) => {
    const picker = vtkPointPicker.newInstance();
    picker.setTolerance(0.01);
    let cssX = 0, cssY = 0;
    p.canvasEl.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = p.canvasEl.getBoundingClientRect();
      cssX = e.clientX - rect.left; cssY = e.clientY - rect.top;
    });
    p.canvasEl.addEventListener('mouseleave', () => { p.tooltip.style.display = 'none'; });
    p.rw.getInteractor().onMouseMove((callData: any) => {
      const pos = callData.position;
      picker.pick([pos.x, pos.y, 0], p.renderer);
      const ptId = picker.getPointId();
      if (ptId >= 0 && ptId < p.scalarsArr.getNumberOfTuples()) {
        const val = p.scalarsArr.getValue(ptId);
        if (isFinite(val)) {
          p.tooltip.textContent = formatValue(val, label_format);
          p.tooltip.style.display = 'block';
          const rect = p.canvasEl.getBoundingClientRect();
          p.tooltip.style.left = `${Math.min(cssX + 12, rect.width - 90)}px`;
          p.tooltip.style.top  = `${Math.max(cssY - 28, 4)}px`;
          return;
        }
      }
      p.tooltip.style.display = 'none';
    });
  });

  // Exposer l'état pour la sync caméra / tooltip (Task 5)
  (container as any).__compare = { panels, label_format, n_colors };
}
