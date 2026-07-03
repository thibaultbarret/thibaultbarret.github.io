// src/scripts/histogram-runtime.ts
// Figure histogramme interactive (uPlot). Config JSON via el.dataset.src :
//   { histogram:true, data, fields_config:[{index,name}], scale?, bins?,
//     x_label?, y_label?, bar_color? }  ; data = .npy shape (N,F,S) ou (N,S).
import uPlot from 'uplot';
import { fetchNpy, idx, formatValue, type NpyArray } from './vtk-core';
import { binEdges, histogramCounts } from './histogram-math';
import { renderTex } from './plot1d-runtime';

type FieldDef = { index: number; name: string };

// data[:, comp, step] (ou data[:, step] si 2D) → vecteur longueur N.
function extractSlice(npy: NpyArray, comp: number, step: number): number[] {
  const N = npy.shape[0];
  const out = new Array<number>(N);
  const is3d = npy.shape.length >= 3;
  for (let p = 0; p < N; p++) {
    out[p] = is3d ? Number(idx(npy.data, npy.shape, p, comp, step))
                  : Number(idx(npy.data, npy.shape, p, step));
  }
  return out;
}

export async function initHistogram(el: HTMLElement): Promise<void> {
  const cfg = await fetch(el.dataset.src!).then(r => r.json());
  const fieldsConfig: FieldDef[] = (Array.isArray(cfg.fields_config) && cfg.fields_config.length > 0)
    ? cfg.fields_config
    : [{ index: 0, name: 'Champ' }];
  const scale: string = cfg.scale ?? 'linear';
  const log = scale === 'log';
  const bins: number = cfg.bins ?? 7;
  const xLabel: string = cfg.x_label ?? 'Valeur';
  const yLabel: string = cfg.y_label ?? 'Effectif';
  const barColor: string = cfg.bar_color ?? '#89b4fa';

  const npy = await fetchNpy(cfg.data);
  const S = npy.shape[npy.shape.length - 1];

  const loading = el.querySelector<HTMLElement>('.hist-loading')!;
  const mount   = el.querySelector<HTMLElement>('.hist-uplot')!;
  const xlabelEl = el.querySelector<HTMLElement>('.hist-xlabel')!;
  const ylabelEl = el.querySelector<HTMLElement>('.hist-ylabel-inner')!;
  const fieldsDiv = el.querySelector<HTMLElement>('.hist-fields')!;
  const slider  = el.querySelector<HTMLInputElement>('.hist-slider')!;
  const datalist = el.querySelector<HTMLDataListElement>('.hist-datalist')!;
  const errEl   = el.querySelector<HTMLElement>('.hist-error')!;
  const tooltip = el.querySelector<HTMLElement>('.hist-tooltip')!;

  // Labels KaTeX
  const xl = el.querySelector<HTMLElement>('.hist-xlabel')!;
  const yl = el.querySelector<HTMLElement>('.hist-ylabel')!;
  if (xLabel) { renderTex(xlabelEl, xLabel, false); xl.style.display = 'block'; }
  if (yLabel) { renderTex(ylabelEl, yLabel, true);  yl.style.display = 'block'; }

  loading.style.display = 'none';

  // État de tranche partagé (lu par range/splits/draw d'uPlot)
  let edges: number[] = [0, 1];
  let counts: number[] = [];
  let u: uPlot | null = null;

  // uPlot peut passer null dans les splits de l'axe log → garder l'axe robuste
  // (sinon formatValue(null) plante et tout le rendu uPlot avorte).
  const fmtTick = (v: number | null | undefined) =>
    (v == null || !isFinite(v)) ? '' : formatValue(v, '.1e');

  function buildPlot() {
    const opts: uPlot.Options = {
      width: mount.clientWidth || 300,
      height: mount.clientHeight || 200,
      cursor: { drag: { x: false, y: false }, points: { show: false } },
      legend: { show: false },
      scales: {
        x: { distr: log ? 3 : 1, range: () => [edges[0], edges[edges.length - 1]] as uPlot.Range.MinMax },
        y: { range: [0, 1], auto: false },
      },
      axes: [
        { stroke: '#a6adc8', grid: { stroke: '#313244', width: 1 }, ticks: { stroke: '#45475a' },
          splits: () => edges, values: (_u, sp) => sp.map(fmtTick), font: '10px monospace', rotate: -35, size: 50 },
        { stroke: '#a6adc8', grid: { stroke: '#313244', width: 1 }, ticks: { stroke: '#45475a' },
          font: '11px monospace' },
      ],
      series: [
        {},
        { paths: () => null, points: { show: false } },
      ],
      hooks: {
        draw: [(self) => {
          const ctx = self.ctx;
          const y0 = self.valToPos(0, 'y', true);
          ctx.save();
          ctx.fillStyle = barColor; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
          for (let i = 0; i < counts.length; i++) {
            const xL = self.valToPos(edges[i], 'x', true);
            const xR = self.valToPos(edges[i + 1], 'x', true);
            const yT = self.valToPos(counts[i], 'y', true);
            ctx.fillRect(xL, yT, xR - xL, y0 - yT);
            ctx.strokeRect(xL, yT, xR - xL, y0 - yT);
          }
          ctx.restore();
        }],
        setCursor: [(self) => {
          const { left, top } = self.cursor;
          if (left == null || left < 0) { tooltip.style.display = 'none'; return; }
          const vx = self.posToVal(left, 'x');
          let bin = -1;
          for (let i = 0; i < counts.length; i++) if (vx >= edges[i] && vx <= edges[i + 1]) { bin = i; break; }
          if (bin < 0) { tooltip.style.display = 'none'; return; }
          tooltip.innerHTML = `[${fmtTick(edges[bin])}, ${fmtTick(edges[bin + 1])}]<br>${(counts[bin] * 100).toFixed(1)} %`;
          tooltip.style.display = 'block';
          const orect = (self as any).over.getBoundingClientRect();
          const frect = el.getBoundingClientRect();
          tooltip.style.left = `${orect.left - frect.left + (left ?? 0) + 12}px`;
          tooltip.style.top  = `${orect.top  - frect.top  + (top  ?? 0) + 12}px`;
        }],
      },
    };
    u = new uPlot(opts, [[edges[0], edges[edges.length - 1]], [null, null]] as unknown as uPlot.AlignedData, mount);
  }

  function render(step: number, fieldIdx: number) {
    const values = extractSlice(npy, fieldIdx, step);
    let vmin = Infinity, vmax = -Infinity;
    for (let i = 0; i < values.length; i++) { const v = values[i]; if (isFinite(v)) { if (v < vmin) vmin = v; if (v > vmax) vmax = v; } }
    const name = fieldsConfig.find(f => f.index === fieldIdx)?.name ?? String(fieldIdx);

    if (log && !(vmin > 0)) {
      errEl.textContent = `⚠ Histogramme log impossible : le champ « ${name} » contient des valeurs ≤ 0 (min = ${formatValue(vmin, '.2e')}).`;
      errEl.style.display = 'flex'; if (u) mount.style.visibility = 'hidden'; return;
    }
    if (!(vmin < vmax)) {
      errEl.textContent = `⚠ Histogramme impossible : le champ « ${name} » est constant (valeur = ${formatValue(vmin, '.2e')}).`;
      errEl.style.display = 'flex'; mount.style.visibility = 'hidden'; return;
    }
    errEl.style.display = 'none'; mount.style.visibility = 'visible';

    edges = binEdges(vmin, vmax, bins, log);
    counts = histogramCounts(values, edges).counts;
    const centers = counts.map((_, i) => edges[i] + (edges[i + 1] - edges[i]) / 2);
    if (!u) buildPlot();
    u!.setData([centers, counts] as uPlot.AlignedData);
  }

  // Sélecteur de composante (comme les figures de champ)
  let currentField = fieldsConfig[0].index;
  let currentStep = 0;
  if (fieldsConfig.length > 1) {
    fieldsDiv.style.display = 'flex';
    fieldsConfig.forEach(({ index, name }) => {
      const btn = document.createElement('button');
      btn.dataset.idx = String(index);
      renderTex(btn, name, false);
      const active = index === currentField;
      btn.style.cssText = `padding:3px 10px;font:11px monospace;border-radius:4px;cursor:pointer;border:1px solid #45475a;background:${active ? '#89b4fa' : '#313244'};color:${active ? '#1e1e2e' : '#cdd6f4'};`;
      btn.addEventListener('click', () => {
        stopAnim();
        fieldsDiv.querySelectorAll('button').forEach(b => { b.style.background = '#313244'; b.style.color = '#cdd6f4'; });
        btn.style.background = '#89b4fa'; btn.style.color = '#1e1e2e';
        currentField = index; render(currentStep, currentField);
      });
      fieldsDiv.appendChild(btn);
    });
  }

  // Barre de contrôles de lecture (⏮ ⏪ ▶/⏸ ⏩ ⏭ + compteur), miroir de VtkFigure
  const controls = el.querySelector<HTMLElement>('.hist-controls')!;
  const label    = el.querySelector<HTMLElement>('.hist-label')!;
  const playBtn  = el.querySelector<HTMLButtonElement>('.hist-play')!;
  const firstBtn = el.querySelector<HTMLButtonElement>('.hist-first')!;
  const prevBtn  = el.querySelector<HTMLButtonElement>('.hist-prev')!;
  const nextBtn  = el.querySelector<HTMLButtonElement>('.hist-next')!;
  const lastBtn  = el.querySelector<HTMLButtonElement>('.hist-last')!;
  let animTimer: ReturnType<typeof setInterval> | null = null;

  function stopAnim() {
    if (animTimer) { clearInterval(animTimer); animTimer = null; playBtn.textContent = '▶'; }
  }
  function goTo(pos: number) {
    currentStep = Math.max(0, Math.min(pos, S - 1));
    label.textContent = `${currentStep + 1}/${S}`;
    slider.value = String(currentStep);
    render(currentStep, currentField);
  }

  if (S > 1) {
    controls.style.display = 'flex';
    slider.max = String(S - 1);
    const listId = 'hist-dl-' + Math.random().toString(36).slice(2);
    datalist.id = listId; slider.setAttribute('list', listId);
    for (let i = 0; i < S; i++) { const o = document.createElement('option'); o.value = String(i); datalist.appendChild(o); }
    label.textContent = `1/${S}`;
    slider.addEventListener('input', () => { stopAnim(); goTo(parseInt(slider.value)); });
    firstBtn.addEventListener('click', () => { stopAnim(); goTo(0); });
    prevBtn.addEventListener('click',  () => { stopAnim(); goTo(currentStep - 1); });
    nextBtn.addEventListener('click',  () => { stopAnim(); goTo(currentStep + 1); });
    lastBtn.addEventListener('click',  () => { stopAnim(); goTo(S - 1); });
    playBtn.addEventListener('click', () => {
      if (animTimer) { stopAnim(); }
      else { playBtn.textContent = '⏸'; animTimer = setInterval(() => goTo((currentStep + 1) % S), 200); }
    });
  }

  // Redimensionnement
  const ro = new ResizeObserver(() => { if (u) u.setSize({ width: mount.clientWidth, height: mount.clientHeight }); });
  ro.observe(mount);

  render(currentStep, currentField);
}
