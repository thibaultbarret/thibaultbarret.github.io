// Comportement de la barre de lecture commune (src/components/VtkPlayerBar.astro).
// Chaque figure ne fournit que render(step, field) ; l'ordre des rendus et la
// cadence de lecture viennent de player-core.ts.
import { createRenderScheduler, nextFrameDelay } from './player-core';

export interface PlayerField { index: number; name: string }
export interface Player { goTo(step: number): void; stop(): void }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Branche la barre et fait le rendu du pas 0 / première composante.
 * Rejette si ce premier rendu échoue (l'appelant affiche son message d'erreur).
 */
export async function createPlayer(bar: HTMLElement, opts: {
  steps: number;
  fields: PlayerField[];
  render: (step: number, field: number) => Promise<void>;
}): Promise<Player> {
  const { steps, fields, render } = opts;
  const q = <T extends Element>(sel: string): T => {
    const el = bar.querySelector<T>(sel);
    if (!el) throw new Error(`VtkPlayer : élément ${sel} absent de la barre`);
    return el;
  };
  const select = q<HTMLSelectElement>('.vp-field');
  const transport = q<HTMLElement>('.vp-transport');
  const play = q<HTMLButtonElement>('.vp-play');
  const slider = q<HTMLInputElement>('.vp-slider');
  const count = q<HTMLElement>('.vp-count');

  let step = 0;
  let field = fields[0]?.index ?? 0;
  await render(step, field);
  const scheduler = createRenderScheduler(render, { step, field },
    err => console.error('[VtkPlayer]', err));

  function showStep() {
    slider.value = String(step);
    slider.style.setProperty('--p', steps > 1 ? `${(step / (steps - 1)) * 100}%` : '0%');
    count.textContent = `${step + 1} / ${steps}`;
  }
  function request(): Promise<void> {
    showStep();
    return scheduler.request(step, field);
  }
  function goTo(s: number) {
    step = Math.max(0, Math.min(s, steps - 1));
    void request();
  }

  // Jeton : une seule boucle de lecture vivante ; stop() l'invalide.
  let playToken = 0;
  function setPlaying(on: boolean) {
    const label = on ? 'Pause' : 'Lecture';
    play.setAttribute('aria-pressed', String(on));
    play.setAttribute('aria-label', label);
    play.title = label;
  }
  function stop() { playToken++; setPlaying(false); }
  async function playLoop(token: number) {
    while (token === playToken) {
      const t0 = performance.now();
      step = (step + 1) % steps;
      await request();
      if (token !== playToken) return;
      await sleep(nextFrameDelay(performance.now() - t0));
    }
  }

  // Composante
  if (fields.length > 1) {
    for (const f of fields) select.add(new Option(f.name, String(f.index)));
    select.value = String(field);
    select.hidden = false;
    select.addEventListener('change', () => { stop(); field = Number(select.value); void request(); });
  }

  // Pas
  if (steps > 1) {
    slider.max = String(steps - 1);
    slider.addEventListener('input', () => { stop(); goTo(Number(slider.value)); });
    q('.vp-first').addEventListener('click', () => { stop(); goTo(0); });
    q('.vp-prev').addEventListener('click', () => { stop(); goTo(step - 1); });
    q('.vp-next').addEventListener('click', () => { stop(); goTo(step + 1); });
    q('.vp-last').addEventListener('click', () => { stop(); goTo(steps - 1); });
    play.addEventListener('click', () => {
      if (play.getAttribute('aria-pressed') === 'true') { stop(); return; }
      const token = ++playToken;
      setPlaying(true);
      void playLoop(token);
    });
  } else {
    transport.hidden = true; slider.hidden = true; count.hidden = true;
  }

  showStep();
  return { goTo, stop };
}
