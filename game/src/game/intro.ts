import { Input } from '../core/input';
import { img } from '../render/assets';
import { podParts } from '../render/textures';
import { VIEW_W, VIEW_H } from '../data/spec';
import { GREEN, GREEN_DIM, MONO, glowText, chunky } from '../ui/crt';

/**
 * The opening, built to narrative-design.md § "The opening — the hook".
 *
 * The load-bearing idea is that the horror beat and the tutorial beat are the
 * SAME beat. The Foreman never explains anything; it resumes a calibration
 * checklist mid-sentence, as though no time has passed, and that checklist
 * happens to teach the controls. Nothing announces the reveal — the machine's
 * own lights come up before a single line plays, so the player registers "I am
 * the machine" in passing rather than being told.
 *
 * Deliberately short. A few minutes of environmental art and a handful of
 * terse lines, not a cutscene-heavy prologue.
 */

type Beat =
  | 'dark'      // muffled, nothing visible
  | 'drain'     // fluid falls away, restraints release
  | 'wake'      // the machine's own lights flicker on. No dialogue yet.
  | 'room'      // the lab resolves out of the dark
  | 'drive'     // checklist: lateral drive     <- LEFT / RIGHT
  | 'lift'      // checklist: lift              <- UP
  | 'cut'       // checklist: cutting head      <- DOWN
  | 'terminal'  // optional, missable: a fragment on a dead console
  | 'doors'     // the bay opens, the register changes
  | 'done';

/** Ordered so a beat can advance to the next without naming it. */
const ORDER: Beat[] = [
  'dark', 'drain', 'wake', 'room', 'drive', 'lift', 'cut', 'terminal', 'doors', 'done',
];

/** Beats that simply play out; the rest wait on the player. */
const TIMED: Partial<Record<Beat, number>> = {
  dark: 2200, drain: 4200, wake: 3200, room: 3000, terminal: 5200, doors: 4600,
};

/** Frames of input required to satisfy a calibration step. */
const CONFIRM_FRAMES = 14;

export class Intro {
  private beat: Beat = 'dark';
  private t = 0;
  private held = 0;
  /** Set once the player actually reads the console. Missable by design. */
  private readTerminal = false;
  /** Drives the machine's own idle motion during the checklist. */
  private podDX = 0;
  private thrust = 0;
  private drillDown = false;

  get finished(): boolean { return this.beat === 'done'; }

  // ------------------------------------------------------------------ update
  /** One fixed step. `dt` is ms. */
  update(dt: number, input: Input): void {
    if (this.beat === 'done') return;
    this.t += dt;

    // Escape hatch. Anyone replaying, or testing, should never be trapped here.
    if (input.justPressed('cancel')) { this.beat = 'done'; return; }

    const limit = TIMED[this.beat];
    if (limit !== undefined) {
      // Timed beats also have to stand the machine back down, or it keeps
      // whatever pose the last calibration step left it in.
      this.podDX = 0;
      this.drillDown = false;
      this.thrust = Math.max(0, this.thrust - 0.06);
      if (this.beat === 'terminal' && input.justPressed('confirm')) this.readTerminal = true;
      if (this.t >= limit) this.next();
      return;
    }

    // ---- the three calibration steps, each gated on the real control
    const want =
      this.beat === 'drive' ? (input.held('left') || input.held('right'))
      : this.beat === 'lift' ? input.held('up')
      : input.held('down');

    this.podDX = this.beat === 'drive' && want ? (input.held('left') ? -1 : 1) : 0;
    this.thrust = this.beat === 'lift' && want ? Math.min(1, this.thrust + 0.08) : Math.max(0, this.thrust - 0.06);
    this.drillDown = this.beat === 'cut' && want;

    this.held = want ? this.held + 1 : Math.max(0, this.held - 2);
    if (this.held >= CONFIRM_FRAMES) this.next();
  }

  private next(): void {
    this.beat = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(this.beat) + 1)];
    this.t = 0;
    this.held = 0;
  }

  // ------------------------------------------------------------------ draw
  draw(g: CanvasRenderingContext2D, time: number): void {
    g.save();
    g.fillStyle = '#05060a';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const roomLight = this.roomLight();
    if (roomLight > 0) this.drawRoom(g, roomLight, time);

    // The machine is visible from 'wake' onward — before anyone speaks.
    if (this.since('wake')) this.drawMachine(g, time);

    if (this.beat === 'drain') this.drawFluid(g, time);
    if (this.beat === 'dark' || this.beat === 'drain') this.drawMuffle(g, time);

    this.drawDoors(g);
    this.drawCaption(g, time);
    this.drawSkipHint(g);
    g.restore();
  }

  /** True once we have reached `b` in the running order. */
  private since(b: Beat): boolean {
    return ORDER.indexOf(this.beat) >= ORDER.indexOf(b);
  }

  private roomLight(): number {
    if (!this.since('room')) return 0;
    if (this.beat === 'room') return Math.min(1, this.t / 2200);
    return 1;
  }

  // ---- the room: rows of drained specimen tanks, dead consoles, decades of
  //      neglect. The art carries this; there is no exposition text.
  private drawRoom(g: CanvasRenderingContext2D, a: number, time: number): void {
    const bg = img('bg_lab');
    g.globalAlpha = a;
    if (bg) {
      const s = Math.max(VIEW_W / bg.width, VIEW_H / bg.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(bg, (VIEW_W - bg.width * s) / 2, (VIEW_H - bg.height * s) / 2,
        bg.width * s, bg.height * s);
      g.imageSmoothingEnabled = false;
    } else {
      // Fallback so the beat still reads with no generated art present.
      g.fillStyle = '#101a18';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 6; i++) {
        const x = 40 + i * 128;
        g.fillStyle = 'rgba(60,110,90,.35)';
        g.fillRect(x, 90, 70, 240);
        g.fillStyle = 'rgba(150,220,190,.18)';
        g.fillRect(x + 6, 96, 20, 228);
      }
    }

    // one failing overhead light, guttering
    const flick = 0.55 + 0.45 * Math.sin(time * 0.004) * Math.sin(time * 0.017);
    const lamp = g.createRadialGradient(VIEW_W * 0.42, -60, 20, VIEW_W * 0.42, 120, 420);
    lamp.addColorStop(0, `rgba(150,220,210,${0.16 * flick * a})`);
    lamp.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lamp;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    g.globalAlpha = 1;
    this.drawVignette(g, 0.55);
  }

  // ---- the machine, drawn large. Same sprite the player will drive.
  private drawMachine(g: CanvasRenderingContext2D, time: number): void {
    const p = podParts(0, 0, 0);
    const S = 4;
    const cx = VIEW_W / 2 + this.podDX * 26;
    const cy = VIEW_H * 0.64 - this.thrust * 18;

    g.save();
    g.translate(Math.round(cx), Math.round(cy));
    g.scale(S, S);
    g.imageSmoothingEnabled = false;

    // Before the room lights come up the machine is barely there — it should
    // emerge out of the dark as its own systems come on, not be revealed by
    // someone turning a light on.
    if (this.beat === 'wake') g.globalAlpha = 0.12 + 0.55 * Math.min(1, this.t / 2900);

    // Exhaust first so the plume sits behind the hull's own silhouette.
    if (this.thrust > 0.02) {
      for (const n of p.nozzles) {
        const len = 6 + this.thrust * 20 * (0.85 + 0.15 * Math.sin(time * 0.09));
        const grd = g.createLinearGradient(0, n.y, 0, n.y + len);
        grd.addColorStop(0, 'rgba(255,252,240,.95)');
        grd.addColorStop(0.4, 'rgba(255,200,120,.7)');
        grd.addColorStop(1, 'rgba(255,140,60,0)');
        g.fillStyle = grd;
        g.fillRect(n.x - 2.5, n.y, 5, len);
      }
    }

    g.drawImage(p.body, -p.w / 2, -p.h / 2);

    g.save();
    g.translate(-p.w / 2 + p.seam - (this.drillDown ? 12 : 0), 0);
    if (this.drillDown) {
      g.rotate(Math.PI / 2);
      g.rotate(Math.sin(time * 0.05) * 0.08);       // biting
    }
    g.drawImage(p.drill, 0, -(this.drillDown ? p.drillMidY : p.h / 2));
    g.restore();
    g.globalAlpha = 1;
    g.restore();

    // The canopy stutters alive before any line plays. This is the reveal,
    // and it is deliberately never remarked upon.
    if (this.beat === 'wake') {
      const k = Math.min(1, this.t / 2600);
      const on = Math.sin(this.t * 0.03) > -0.2 + (1 - k);
      if (on) {
        const glow = g.createRadialGradient(cx + 12, cy - 24, 2, cx + 12, cy - 24, 90 * k);
        glow.addColorStop(0, `rgba(120,230,250,${0.5 * k})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
  }

  // ---- suspension fluid falling away past the canopy
  private drawFluid(g: CanvasRenderingContext2D, time: number): void {
    const k = Math.min(1, this.t / 3400);
    const line = VIEW_H * k;

    g.fillStyle = 'rgba(38,92,74,.55)';
    g.fillRect(0, line, VIEW_W, VIEW_H - line);
    g.fillStyle = 'rgba(150,230,200,.35)';
    g.fillRect(0, line, VIEW_W, 3);

    for (let i = 0; i < 26; i++) {
      const bx = ((i * 137.5) % VIEW_W);
      const by = VIEW_H - ((time * 0.07 + i * 61) % (VIEW_H - line));
      if (by < line) continue;
      const r = 1 + (i % 3);
      g.fillStyle = 'rgba(190,255,230,.4)';
      g.fillRect(Math.round(bx), Math.round(by), r, r);
    }
  }

  /** Heavy vignette and a low waterline of noise: hearing through fluid. */
  private drawMuffle(g: CanvasRenderingContext2D, time: number): void {
    this.drawVignette(g, 0.85);
    g.globalAlpha = 0.05 + 0.03 * Math.sin(time * 0.02);
    g.fillStyle = '#8fd6c0';
    for (let y = 0; y < VIEW_H; y += 3) g.fillRect(0, y, VIEW_W, 1);
    g.globalAlpha = 1;
  }

  private drawVignette(g: CanvasRenderingContext2D, strength: number): void {
    const v = g.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.22,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.82);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${strength})`);
    g.fillStyle = v;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** The bay doors parting on the outpost, at the very end. */
  private drawDoors(g: CanvasRenderingContext2D): void {
    if (this.beat !== 'doors') return;
    const k = Math.min(1, Math.max(0, (this.t - 900) / 2600));
    const gap = k * VIEW_W * 0.5;

    const light = g.createLinearGradient(VIEW_W / 2 - gap, 0, VIEW_W / 2 + gap, 0);
    light.addColorStop(0, 'rgba(255,214,160,0)');
    light.addColorStop(0.5, `rgba(255,222,175,${0.5 * k})`);
    light.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = light;
    g.fillRect(VIEW_W / 2 - gap, 0, gap * 2, VIEW_H);

    g.fillStyle = `rgba(255,236,200,${k * k})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- captions. The Foreman resumes mid-sentence; it never greets you.
  private line(): [string, string] | null {
    switch (this.beat) {
      case 'drain':
        return ['', 'Restraints released. Drain cycle complete.'];
      case 'room':
        return ['FOREMAN', '— and we are resuming the calibration list from item four.'];
      case 'drive':
        return ['FOREMAN', 'Confirm lateral drive.        [ LEFT / RIGHT ]'];
      case 'lift':
        return ['FOREMAN', 'Confirm lift.                        [ UP ]'];
      case 'cut':
        return ['FOREMAN', 'Confirm cutting head.              [ DOWN ]'];
      case 'terminal':
        return this.readTerminal
          ? ['LOG FRAGMENT', 'subject retains motor memory. recommend redeployment. no further review required.']
          : ['FOREMAN', 'Calibration complete. Unit is within tolerance.'];
      case 'doors':
        return ['FOREMAN', 'Welcome to Venice! Your first shift starts today. Dig well!'];
      default:
        return null;
    }
  }

  private drawCaption(g: CanvasRenderingContext2D, time: number): void {
    const l = this.line();
    if (!l) return;
    const [who, text] = l;

    // fade in, and hold
    const a = Math.min(1, this.t / 500);
    g.globalAlpha = a;

    const y = VIEW_H - 92;
    g.fillStyle = 'rgba(4,10,6,.72)';
    g.fillRect(0, y - 26, VIEW_W, 74);
    g.strokeStyle = 'rgba(93,255,100,.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y - 26.5); g.lineTo(VIEW_W, y - 26.5);
    g.moveTo(0, y + 47.5); g.lineTo(VIEW_W, y + 47.5);
    g.stroke();

    g.textAlign = 'center';
    if (who) glowText(g, who, VIEW_W / 2, y, 12, GREEN_DIM);
    glowText(g, text, VIEW_W / 2, y + 24, 15, GREEN);

    // A prompt only appears once the player has had a moment to not need it.
    if (this.awaitingInput() && this.t > 2600) {
      g.globalAlpha = a * (0.4 + 0.35 * Math.sin(time * 0.006));
      glowText(g, 'awaiting input', VIEW_W / 2, y + 42, 10, GREEN_DIM);
    }
    if (this.beat === 'terminal' && !this.readTerminal) {
      g.globalAlpha = a * 0.75;
      glowText(g, '[ SPACE ]  read the console', VIEW_W / 2, y + 42, 10, GREEN_DIM);
    }

    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  private awaitingInput(): boolean {
    return this.beat === 'drive' || this.beat === 'lift' || this.beat === 'cut';
  }

  private drawSkipHint(g: CanvasRenderingContext2D): void {
    if (this.beat === 'doors') return;
    g.save();
    g.globalAlpha = 0.34;
    g.font = MONO(10);
    g.textAlign = 'right';
    g.fillStyle = GREEN_DIM;
    g.fillText('[ ESC ] skip', VIEW_W - 14, VIEW_H - 12);
    g.restore();
    g.textAlign = 'left';
  }

  /** Title card, drawn over the opening dark. */
  drawTitle(g: CanvasRenderingContext2D): void {
    if (this.beat !== 'dark') return;
    const a = Math.min(1, this.t / 900) * Math.min(1, (2200 - this.t) / 700);
    if (a <= 0) return;
    g.save();
    g.globalAlpha = Math.max(0, a);
    g.textAlign = 'center';
    chunky(g, 'THE LAST DIRECTIVE', VIEW_W / 2, VIEW_H / 2, 34, '#cfe8d6', 'center');
    g.restore();
    g.textAlign = 'left';
  }
}
