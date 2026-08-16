import { Game } from './game/game';
import { Input } from './core/input';
import { loadBackdrop } from './render/render';
import { loadAssets } from './render/assets';
import { VIEW_W, VIEW_H } from './data/spec';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const ctx = canvas.getContext('2d', { alpha: false })!;
ctx.imageSmoothingEnabled = false;

/** Integer-scale the canvas to fill the window without blurring pixels. */
function fit(): void {
  const s = Math.max(1, Math.min(
    Math.floor((window.innerWidth / VIEW_W) * 20) / 20,
    Math.floor((window.innerHeight / VIEW_H) * 20) / 20,
  ));
  canvas.style.width = `${VIEW_W * s}px`;
  canvas.style.height = `${VIEW_H * s}px`;
}
window.addEventListener('resize', fit);
fit();

// Optional generated backdrop; silently ignored if the file isn't there.
loadBackdrop('surface', 'bg/surface.png');

const input = new Input();

// Mouse -> VIEW-space coordinates, so shop UI can be driven with a pointer
// in addition to the keyboard. Click-through from touch is avoided because
// the existing touch handler below calls preventDefault() on touchstart,
// which suppresses the synthetic mouse events browsers would otherwise fire.
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  input.setMousePos(
    (e.clientX - r.left) * (VIEW_W / r.width),
    (e.clientY - r.top) * (VIEW_H / r.height),
  );
});
canvas.addEventListener('mousedown', () => input.setMouseDown(true));
window.addEventListener('mouseup', () => input.setMouseDown(false));
const seed = new URLSearchParams(location.search).get('seed') ?? 'venice-01';
if (new URLSearchParams(location.search).has('wipe')) Game.wipeSave();

// Art must be resident before the first frame: tile textures are cached on
// first use, so a sprite arriving late would be baked out of them for good.
await loadAssets();

const game = new Game(ctx, input, seed);

document.getElementById('boot')?.remove();

let last = performance.now();
let lastRaf = last;

function tick(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  game.update(dt);
}

function frame(now: number): void {
  lastRaf = now;
  tick(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/**
 * requestAnimationFrame is throttled to nothing when the page isn't being
 * composited (hidden tab, offscreen window, headless inspection). Fall back
 * to a timer so the sim keeps running instead of freezing mid-descent.
 */
setInterval(() => {
  if (performance.now() - lastRaf > 300) tick(performance.now());
}, 33);

// Debug handle — harmless in production, invaluable for automated checks.
(window as unknown as Record<string, unknown>).__tld = { game, input };

window.addEventListener('beforeunload', () => game.save());
setInterval(() => game.save(), 10000);

// Touch controls for the mobile build.
if ('ontouchstart' in window) {
  const zones: [string, number, number, number, number][] = [
    ['left', 0, 0.55, 0.22, 1], ['right', 0.22, 0.55, 0.44, 1],
    ['down', 0.44, 0.75, 0.7, 1], ['up', 0.7, 0.55, 1, 1],
  ];
  const hit = (t: Touch): string | null => {
    const fx = t.clientX / window.innerWidth, fy = t.clientY / window.innerHeight;
    for (const [b, x0, y0, x1, y1] of zones)
      if (fx >= x0 && fx < x1 && fy >= y0 && fy < y1) return b;
    return null;
  };
  const apply = (e: TouchEvent) => {
    e.preventDefault();
    const active = new Set<string>();
    for (let i = 0; i < e.touches.length; i++) {
      const b = hit(e.touches[i]);
      if (b) active.add(b);
    }
    for (const b of ['up', 'down', 'left', 'right'] as const) input.setVirtual(b, active.has(b));
    input.setVirtual('confirm', e.touches.length > 0 && active.size === 0);
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    window.addEventListener(ev, apply as EventListener, { passive: false });
}
