// Logique pure du lecteur de figures de champ — aucun import, testée par
// scripts/verify-vtk-player.mjs.

/** Intervalle minimal entre deux pas en lecture (ms). */
export const FRAME_MS = 200;
/** Dé-zoom maximal, en multiple de la vue de référence (après resetCamera). */
export const MAX_ZOOM_OUT = 2;

export interface StepField { step: number; field: number }

export interface RenderScheduler {
  /** Demande l'affichage de (step, field) ; résolue quand plus rien n'est en attente. */
  request(step: number, field: number): Promise<void>;
  shown(): StepField | null;
}

const same = (a: StepField | null, b: StepField) => !!a && a.step === b.step && a.field === b.field;

/**
 * Un seul rendu à la fois ; la demande en attente est écrasée par la suivante :
 * le dernier demandé gagne, aucun rendu périmé n'est affiché après un plus récent.
 */
export function createRenderScheduler(
  render: (step: number, field: number) => Promise<void>,
  initial: StepField,
  onError: (err: unknown) => void,
): RenderScheduler {
  let shown: StepField | null = { ...initial };
  let wanted: StepField = { ...initial };
  let loop: Promise<void> | null = null;

  async function drain() {
    while (!same(shown, wanted)) {
      const snap = wanted;
      try { await render(snap.step, snap.field); }
      catch (err) { onError(err); }
      shown = snap; // traité même en échec, sinon la boucle ne finit jamais
    }
    loop = null;
  }

  return {
    request(step, field) {
      wanted = { step, field };
      if (!loop) loop = drain();
      return loop;
    },
    shown: () => shown,
  };
}

export function nextFrameDelay(elapsedMs: number): number {
  return Math.max(0, FRAME_MS - elapsedMs);
}

export function clampZoomOut(value: number, reference: number): number {
  return Math.min(value, MAX_ZOOM_OUT * reference);
}
