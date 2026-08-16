/**
 * Pip-Boy styled UI chrome: brushed-metal bezel, dark phosphor screen,
 * scanlines, green monospace type with a soft bloom.
 *
 * Used for every menu and for the transmission feed, per the art direction.
 */

export const GREEN = '#5dff64';
export const GREEN_DIM = '#2f9c39';
export const GREEN_FAINT = 'rgba(93,255,100,.32)';
export const SCREEN_BG = '#08160a';

export const MONO = (px: number, bold = false) =>
  `${bold ? '700 ' : ''}${px}px ui-monospace, "Cascadia Mono", Consolas, monospace`;

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Brushed-metal bezel with a recessed screen cut into it.
 *
 * `titleH` reserves a band of bare metal above the screen for an embossed
 * header, the way the original's shop panels carry their name across the
 * casing rather than inside the display.
 */
export function bezel(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  titleH = 0,
): Rect {
  const pad = 18;

  // outer casing
  const shell = g.createLinearGradient(x, y, x, y + h);
  shell.addColorStop(0, '#8d8b82');
  shell.addColorStop(0.18, '#6e6c64');
  shell.addColorStop(0.55, '#565349');
  shell.addColorStop(1, '#3d3b34');
  g.fillStyle = shell;
  g.beginPath();
  g.roundRect(x, y, w, h, 22);
  g.fill();

  // brushed streaks
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, 22); g.clip();
  for (let i = 0; i < 70; i++) {
    const yy = y + (i * 97.3) % h;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.045)';
    g.fillRect(x, yy, w, 1 + (i % 3));
  }
  g.restore();

  // bezel edge highlight / shadow
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.roundRect(x + 1, y + 1, w - 2, h - 2, 21); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.5)';
  g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 8, 19); g.stroke();

  // screen well
  const sx = x + pad, sy = y + pad + titleH, sw = w - pad * 2, sh = h - pad * 2 - titleH;
  g.fillStyle = '#0b0f0b';
  g.beginPath(); g.roundRect(sx - 4, sy - 4, sw + 8, sh + 8, 16); g.fill();

  g.fillStyle = SCREEN_BG;
  g.beginPath(); g.roundRect(sx, sy, sw, sh, 13); g.fill();

  // phosphor glow pooling at the centre
  const glow = g.createRadialGradient(
    sx + sw / 2, sy + sh / 2, 8, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.7);
  glow.addColorStop(0, 'rgba(60,200,80,.13)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.beginPath(); g.roundRect(sx, sy, sw, sh, 13); g.fill();

  return { x: sx, y: sy, w: sw, h: sh };
}

/** Scanlines + vignette. Call after drawing screen contents. */
export function scanlines(
  g: CanvasRenderingContext2D, s: { x: number; y: number; w: number; h: number },
): void {
  g.save();
  g.beginPath(); g.roundRect(s.x, s.y, s.w, s.h, 13); g.clip();

  g.fillStyle = 'rgba(0,0,0,.16)';
  for (let y = s.y; y < s.y + s.h; y += 3) g.fillRect(s.x, y, s.w, 1);

  const vig = g.createRadialGradient(
    s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h) * 0.25,
    s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = vig;
  g.fillRect(s.x, s.y, s.w, s.h);
  g.restore();
}

/** Phosphor text with bloom. */
export function glowText(
  g: CanvasRenderingContext2D, text: string, x: number, y: number,
  size = 15, color = GREEN, bold = false,
): void {
  g.font = MONO(size, bold);
  g.shadowColor = color;
  g.shadowBlur = 9;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
}

/** Chunky outlined display type for the in-world HUD (score, cash, depth). */
export function chunky(
  g: CanvasRenderingContext2D, text: string, x: number, y: number,
  size: number, fill: string, align: CanvasTextAlign = 'left',
): void {
  g.save();
  g.textAlign = align;
  g.font = `700 ${size}px "Trebuchet MS", ui-rounded, system-ui, sans-serif`;
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size * 0.22);
  g.strokeStyle = 'rgba(0,0,0,.85)';
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  g.restore();
}

/**
 * Embossed metal lettering, for panel headers stamped into the casing —
 * a dark cut above and a light bevel below, so it reads as struck into the
 * metal rather than printed on it.
 */
export function embossed(
  g: CanvasRenderingContext2D, text: string, x: number, y: number,
  size: number, align: CanvasTextAlign = 'center',
): void {
  g.save();
  g.textAlign = align;
  g.font = `700 ${size}px "Trebuchet MS", ui-rounded, system-ui, sans-serif`;
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.fillText(text, x, y + 2);
  g.fillStyle = 'rgba(255,255,255,.30)';
  g.fillText(text, x, y - 1);
  const face = g.createLinearGradient(0, y - size, 0, y + 4);
  face.addColorStop(0, '#f2efe6');
  face.addColorStop(0.5, '#bfbcb1');
  face.addColorStop(1, '#8e8b81');
  g.fillStyle = face;
  g.fillText(text, x, y);
  g.restore();
}

export type BtnHue = 'red' | 'green' | 'steel';

/** [face top, face bottom, housing rim, label ink] */
const BTN: Record<BtnHue, [string, string, string, string]> = {
  red:   ['#a8383a', '#6d2224', '#2a1112', '#1c0c0c'],
  green: ['#2f7a3c', '#174f22', '#0d2a12', '#d8ffd8'],
  steel: ['#7f7d74', '#4f4d46', '#26251f', '#0e0e0c'],
};

/**
 * A physical push button with a moulded bevel, as on the original's vendor
 * panels. `active` lights it, for the option the keyboard is pointing at.
 */
export function button(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  label: string, hue: BtnHue = 'red', active = false,
): void {
  const [top, bot, rim, ink] = BTN[hue];

  // recessed housing the button sits in
  g.fillStyle = rim;
  g.beginPath(); g.roundRect(x - 4, y - 4, w + 8, h + 8, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.lineWidth = 1;
  g.beginPath(); g.roundRect(x - 4, y - 4, w + 8, h + 8, 7); g.stroke();

  const face = g.createLinearGradient(0, y, 0, y + h);
  face.addColorStop(0, active ? '#e0e0d0' : top);
  face.addColorStop(1, active ? top : bot);
  g.fillStyle = face;
  g.beginPath(); g.roundRect(x, y, w, h, 4); g.fill();

  // bevel: light along the top, shadow along the bottom
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.moveTo(x + 2, y + 1); g.lineTo(x + w - 2, y + 1); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.45)';
  g.beginPath(); g.moveTo(x + 2, y + h - 1); g.lineTo(x + w - 2, y + h - 1); g.stroke();

  g.save();
  g.textAlign = 'center';
  g.font = `700 ${Math.min(17, Math.round(h * 0.46))}px "Trebuchet MS", ui-rounded, system-ui, sans-serif`;
  g.fillStyle = active ? '#10140f' : ink;
  g.fillText(label, x + w / 2, y + h / 2 + Math.round(h * 0.17));
  g.restore();
}

/** Dotted-border item cell, as around the original's upgrade thumbnails. */
export function cell(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  active = false,
): void {
  g.save();
  g.fillStyle = active ? 'rgba(93,255,100,.14)' : 'rgba(93,255,100,.05)';
  g.fillRect(x, y, w, h);
  g.setLineDash([3, 3]);
  g.lineWidth = 1;
  g.strokeStyle = active ? GREEN : GREEN_FAINT;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.restore();
}

/** The red close stud in the panel's top-right corner. */
export function closeStud(
  g: CanvasRenderingContext2D, cx: number, cy: number, r = 13,
): void {
  const face = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 1, cx, cy, r);
  face.addColorStop(0, '#e4746a');
  face.addColorStop(1, '#8e1f1c');
  g.fillStyle = face;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();

  g.strokeStyle = '#f6e6e2';
  g.lineWidth = 3;
  g.lineCap = 'round';
  const d = r * 0.45;
  g.beginPath();
  g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d);
  g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d);
  g.stroke();
  g.lineCap = 'butt';
}

/** Vertical cylinder gauge, as on the original's HUD. */
export function cylinder(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  frac: number, label: string, hue: [string, string, string],
): void {
  const f = Math.max(0, Math.min(1, frac));
  const [dark, mid, light] = hue;

  // empty well
  g.fillStyle = '#241f1c';
  g.beginPath(); g.ellipse(x + w / 2, y + h, w / 2, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(x, y, w, h);
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 6, 0, 0, Math.PI * 2); g.fill();

  // fill
  const fh = h * f;
  const fy = y + h - fh;
  const body = g.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, dark);
  body.addColorStop(0.35, light);
  body.addColorStop(0.62, mid);
  body.addColorStop(1, dark);
  g.fillStyle = body;
  if (fh > 0) {
    g.fillRect(x, fy, w, fh);
    g.beginPath(); g.ellipse(x + w / 2, y + h, w / 2, 6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x + w / 2, fy, w / 2, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath(); g.ellipse(x + w / 2, fy, w / 2 - 2, 4, 0, 0, Math.PI * 2); g.fill();
  }

  // rim
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 6, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x, y + h);
  g.moveTo(x + w, y); g.lineTo(x + w, y + h);
  g.stroke();

  chunky(g, label, x + w / 2, y + h / 2 + 6, 15, '#ffffff', 'center');
}
