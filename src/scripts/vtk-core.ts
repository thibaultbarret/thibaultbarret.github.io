// src/scripts/vtk-core.ts
// Helpers purs réutilisables par les composants VTK 2D (VtkFigure, VtkFigureCompare).
// Extrait de VtkFigure.astro (2026-06-05). Les viewers existants ne l'importent pas
// encore — migration optionnelle ultérieure.
import vtkTexture   from '@kitware/vtk.js/Rendering/Core/Texture';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import type vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';

// ── Colormaps ─────────────────────────────────────────────────────────────
export const CMAPS: Record<string, [number,number,number,number][]> = {
  viridis:  [[0,.267,.005,.329],[.25,.282,.341,.631],[.5,.129,.569,.553],[.75,.369,.788,.384],[1,.993,.906,.144]],
  // ColorBrewer RdYlGn — 11 points de contrôle matplotlib (rouge→jaune→vert)
  RdYlGn:   [[0,.647,0,.149],[.1,.843,.188,.153],[.2,.957,.427,.263],[.3,.992,.682,.380],[.4,.996,.878,.545],[.5,1,1,.749],[.6,.851,.937,.545],[.7,.651,.851,.416],[.8,.400,.741,.388],[.9,.102,.596,.314],[1,0,.408,.216]],
  // RdYlGn_r — inverse (vert→jaune→rouge)
  RdYlGn_r: [[0,0,.408,.216],[.1,.102,.596,.314],[.2,.400,.741,.388],[.3,.651,.851,.416],[.4,.851,.937,.545],[.5,1,1,.749],[.6,.996,.878,.545],[.7,.992,.682,.380],[.8,.957,.427,.263],[.9,.843,.188,.153],[1,.647,0,.149]],
  coolwarm: [[0,.230,.299,.754],[.5,.865,.865,.865],[1,.706,.016,.150]],
  jet:      [[0,0,0,.5],[.125,0,0,1],[.375,0,1,1],[.625,1,1,0],[.875,1,0,0],[1,.5,0,0]],
  // Spectre Rainbow par défaut d'Abaqus/CAE — 12 couleurs (bleu→cyan→vert→jaune→rouge)
  abaqus:   [[0,0,0,1],[.091,0,.365,1],[.182,0,.725,1],[.273,0,1,.910],[.364,0,1,.545],[.455,0,1,.180],[.545,.180,1,0],[.636,.545,1,0],[.727,.910,1,0],[.818,1,.725,0],[.909,1,.365,0],[1,1,0,0]],
};

export function interpolateCmap(stops: [number,number,number,number][], t: number): [number, number, number] {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const f = (t - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
      return [1, 2, 3].map(k => stops[i-1][k] + (stops[i][k] - stops[i-1][k]) * f) as [number, number, number];
    }
  }
  const last = stops.at(-1)!;
  return [last[1], last[2], last[3]];
}

// ── Parser .npy ───────────────────────────────────────────────────────────
export interface NpyArray { data: ArrayLike<number>; shape: number[] }

export async function fetchNpy(url: string): Promise<NpyArray> {
  const buf   = await fetch(url).then(r => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  const major = bytes[6];
  const hlen  = major === 1 ? (bytes[8] | bytes[9] << 8) : (bytes[8] | bytes[9]<<8 | bytes[10]<<16 | bytes[11]<<24);
  const hOff  = (major === 1 ? 10 : 12);
  const header = new TextDecoder().decode(bytes.slice(hOff, hOff + hlen));
  const dtype  = (header.match(/'descr'\s*:\s*'([^']+)'/) ?? ['','<f8'])[1];
  const shape  = (header.match(/'shape'\s*:\s*\(([^)]*)\)/) ?? ['',''])[1]
    .split(',').map(s => s.trim()).filter(Boolean).map(Number);
  const raw = buf.slice(hOff + hlen);
  let data: ArrayLike<number>;
  if      (dtype.endsWith('f8')) data = new Float64Array(raw);
  else if (dtype.endsWith('f4')) data = new Float32Array(raw);
  else if (dtype.endsWith('i4') || dtype.endsWith('u4')) data = new Int32Array(raw);
  else if (dtype.endsWith('i8') || dtype.endsWith('u8')) { const b = new BigInt64Array(raw); data = Int32Array.from(b, v => Number(v)); }
  else if (dtype.endsWith('i2') || dtype.endsWith('u2')) data = new Int16Array(raw);
  else if (dtype.endsWith('u1')) data = new Uint8Array(raw);
  else if (dtype.endsWith('i1')) data = new Int8Array(raw);
  else data = new Float64Array(raw);
  return { data, shape };
}

export function idx(arr: ArrayLike<number>, shape: number[], ...ix: number[]) {
  let o = 0, s = 1;
  for (let i = shape.length - 1; i >= 0; i--) { o += (ix[i] ?? 0) * s; s *= shape[i]; }
  return arr[o] as number;
}

// ── Construction du PolyData ──────────────────────────────────────────────
export interface RawData { coords: NpyArray; triangles: NpyArray; fields: NpyArray; disp: NpyArray | null }

export function buildPositions(raw: RawData, stepIdx: number, H: number): Float32Array {
  const { coords, disp } = raw;
  const N = coords.shape[0];
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x = idx(coords.data, coords.shape, i, 0);
    let y = idx(coords.data, coords.shape, i, 1);
    if (disp) {
      x += disp.shape.length === 3 ? idx(disp.data, disp.shape, i, 0, stepIdx) : idx(disp.data, disp.shape, i, 0);
      y += disp.shape.length === 3 ? idx(disp.data, disp.shape, i, 1, stepIdx) : idx(disp.data, disp.shape, i, 1);
    }
    pos[i*3] = x; pos[i*3+1] = H - y; pos[i*3+2] = 0;
  }
  return pos;
}

export function buildScalars(raw: RawData, stepIdx: number, fieldIdx: number): Float32Array {
  const { fields } = raw;
  const N = fields.shape[0];
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = fields.shape.length === 3 ? idx(fields.data, fields.shape, i, fieldIdx, stepIdx)
           : fields.shape.length === 2 ? idx(fields.data, fields.shape, i, fieldIdx)
           : (fields.data[i] as number);
  }
  return out;
}

export function fieldRange(sc: Float32Array): [number, number] {
  let vmin = Infinity, vmax = -Infinity;
  for (let i = 0; i < sc.length; i++) {
    if (isFinite(sc[i])) { vmin = Math.min(vmin, sc[i]); vmax = Math.max(vmax, sc[i]); }
  }
  return [vmin, vmax];
}

export function makeCells(raw: RawData): Uint32Array {
  const { triangles } = raw;
  const T = triangles.shape[0];
  const buf = new Uint32Array(T * 4);
  for (let t = 0; t < T; t++) {
    buf[t*4]   = 3;
    buf[t*4+1] = idx(triangles.data, triangles.shape, t, 0);
    buf[t*4+2] = idx(triangles.data, triangles.shape, t, 1);
    buf[t*4+3] = idx(triangles.data, triangles.shape, t, 2);
  }
  return buf;
}

// ── Textures ──────────────────────────────────────────────────────────────
export async function toTexture(src: string) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error(`Image introuvable : ${src}`)); img.src = src; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, img.width, img.height);
  const sc = vtkDataArray.newInstance({ name:'px', values: new Uint8Array(px.data), numberOfComponents:4 });
  const vi = vtkImageData.newInstance();
  vi.setDimensions(img.width, img.height, 1); vi.setSpacing(1,1,1); vi.getPointData().setScalars(sc);
  const tex = vtkTexture.newInstance(); tex.setInputData(vi); tex.setInterpolate(true);
  return { tex, w: img.width, h: img.height };
}

export function frameToTexture(images: NpyArray, frame: number) {
  const H = images.shape[0], W = images.shape[1], S = images.shape[2] ?? 1;
  const f = Math.max(0, Math.min(frame, S - 1));
  if (f !== frame) console.warn(`[vtk-core] frame image ${frame} hors limites [0, ${S - 1}], clampée à ${f}`);
  const data = images.data;
  const rgba = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    let v = data[p * S + f] as number;
    v = v < 0 ? 0 : v > 255 ? 255 : v | 0;
    const o = p * 4;
    rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
  }
  const sc = vtkDataArray.newInstance({ name: 'px', values: rgba, numberOfComponents: 4 });
  const vi = vtkImageData.newInstance();
  vi.setDimensions(W, H, 1); vi.setSpacing(1, 1, 1); vi.getPointData().setScalars(sc);
  const tex = vtkTexture.newInstance(); tex.setInputData(vi); tex.setInterpolate(true);
  return { tex, w: W, h: H };
}

// ── Formatage ─────────────────────────────────────────────────────────────
export function formatValue(v: number, fmt: string): string {
  const m = fmt.match(/^\.(\d+)([efg])$/);
  if (!m) return String(v);
  const n = parseInt(m[1]);
  if (m[2] === 'e') return v.toExponential(n);
  if (m[2] === 'f') return v.toFixed(n);
  return v.toPrecision(n);
}

// ── Texte d'un pas ────────────────────────────────────────────────────────
export type StepText = string | Record<string, string>;
export function resolveStepText(t: StepText | undefined, fieldIdx: number): string {
  if (t == null) return '';
  return typeof t === 'string' ? t : (t[String(fieldIdx)] ?? '');
}
export function stepHasText(t: StepText | undefined): boolean {
  if (t == null) return false;
  return typeof t === 'string' ? t.length > 0 : Object.keys(t).length > 0;
}

// ── LUT en escalier (fonction pure : la LUT est passée en argument) ─────────
// Chaque bande a un nœud d'entrée ET de sortie ; la dernière va jusqu'à vmax
// sans eps (sinon la couleur max n'occupe que le pic exact — cf. LRN-018).
export function configureLut(
  lut: vtkColorTransferFunction,
  stops: [number,number,number,number][],
  nColors: number,
  vmin: number,
  vmax: number,
) {
  lut.removeAllPoints();
  const range = (vmax - vmin) || 1;
  const eps = range * 1e-7;
  for (let i = 0; i < nColors; i++) {
    const t = nColors > 1 ? i / (nColors - 1) : 0.5;
    const [r, g, b] = interpolateCmap(stops, t);
    const v_lo = vmin + (i / nColors) * range;
    const v_hi = vmin + ((i + 1) / nColors) * range;
    lut.addRGBPoint(v_lo, r, g, b);
    lut.addRGBPoint(i < nColors - 1 ? v_hi - eps : v_hi, r, g, b);
  }
  lut.setMappingRange(vmin, vmax);
  lut.updateRange();
}

// ── Colorbar (éléments DOM passés explicitement) ───────────────────────────
export interface ColorbarEls { title: HTMLElement; canvas: HTMLCanvasElement; labels: HTMLElement }
export function drawColorbar(
  els: ColorbarEls, name: string, stops: [number,number,number,number][],
  vmin: number, vmax: number, nColors: number, labelFmt: string, labelColor: string,
) {
  const { title, canvas, labels } = els;
  const Hpx = canvas.height;
  labels.innerHTML = '';
  title.textContent = name;
  const ctx = canvas.getContext('2d')!;
  const bandH = Hpx / nColors;
  for (let i = 0; i < nColors; i++) {
    const t = nColors > 1 ? (nColors - 1 - i) / (nColors - 1) : 0.5;
    const [r, gg, b] = interpolateCmap(stops, t);
    ctx.fillStyle = `rgb(${(r*255)|0},${(gg*255)|0},${(b*255)|0})`;
    ctx.fillRect(0, Math.floor(i * bandH), canvas.width, Math.ceil(bandH) + 1);
  }
  for (let i = 0; i <= nColors; i++) {
    const v = vmin + (vmax - vmin) * (1 - i / nColors);
    const s = document.createElement('span');
    s.style.cssText = `position:absolute;top:${i * Hpx / nColors}px;right:0;transform:translateY(-50%);color:${labelColor};font:11px monospace;text-align:right;white-space:nowrap;`;
    s.textContent = formatValue(v, labelFmt);
    labels.appendChild(s);
  }
}
