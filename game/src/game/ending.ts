import { Input } from '../core/input';
import { img } from '../render/assets';
import { podParts } from '../render/textures';
import { VIEW_W, VIEW_H } from '../data/spec';
import { GREEN, GREEN_DIM, MONO, glowText, chunky, button } from '../ui/crt';

/**
 * The ending, built to narrative-design.md § "Locked direction" and § "The
 * ending".
 *
 * Explicitly not a boss fight. It is a confrontation with what remains of the
 * original mission, and the stakes are personal rather than martial: how much
 * of you is left, and what you intend to do about it. The Foreman is not
 * revealed to be a villain — it is revealed to be running on one surviving
 * clause of an instruction set nobody has maintained in a very long time.
 *
 * Rule 2 from the design doc holds all the way through: every beat raises a
 * question it does not answer. Neither ending resolves what the facility was
 * for, how long you were in the tank, or whether you are still meaningfully
 * anyone. Both are meant to sit badly, in different ways.
 */

export type Choice = 'comply' | 'refuse';

type Beat =
  | 'dream'      // the single unrepeated pre-accident flash
  | 'arrive'     // the chamber
  | 'ranks'      // the others, shut down in rows
  | 'foreman'    // the voice, with nothing left in it
  | 'directive'  // the original instruction list, mostly gone
  | 'choice'
  | 'epilogue'
  | 'done';

const ORDER: Beat[] = [
  'dream', 'arrive', 'ranks', 'foreman', 'directive', 'choice', 'epilogue', 'done',
];

const TIMED: Partial<Record<Beat, number>> = {
  dream: 3400, arrive: 4200, ranks: 5200, foreman: 5200, directive: 6400,
};

/**
 * The surviving directive. The list was much longer; this is what is legible.
 * Never completed on screen, by design — the player can see the shape of what
 * is missing without ever being told what it said.
 */
const DIRECTIVE: [string, boolean][] = [
  ['1.  ██████ ███ ████████ ██ ███████', false],
  ['2.  ████████ ██████ ███ ████ ██████████', false],
  ['3.  ███ ██████████ ██ ████ ███████', false],
  ['4.  EXTRACT.', true],
  ['5.  ██████ ███████ ████ ██ ████████ ███', false],
  ['6.  ███ ████ ██████ ████████ ██ ███████ ██', false],
];

export class Ending {
  private beat: Beat = 'dream';
  private t = 0;
  private sel: Choice = 'comply';
  private chosen: Choice | null = null;

  get finished(): boolean { return this.beat === 'done'; }
  get choice(): Choice | null { return this.chosen; }

  // ------------------------------------------------------------------ update
  update(dt: number, input: Input): void {
    if (this.beat === 'done') return;
    this.t += dt;

    if (this.beat === 'choice') {
      if (input.justPressed('left') || input.justPressed('up')) this.sel = 'comply';
      if (input.justPressed('right') || input.justPressed('down')) this.sel = 'refuse';
      if (input.justPressed('confirm')) {
        this.chosen = this.sel;
        this.beat = 'epilogue';
        this.t = 0;
      }
      return;
    }

    if (this.beat === 'epilogue') {
      // A deliberate hold before the player can leave, so the last lines are
      // read rather than skipped past.
      if (this.t > 4000 && input.justPressed('confirm')) this.beat = 'done';
      return;
    }

    const limit = TIMED[this.beat];
    if (limit !== undefined && this.t >= limit) {
      this.beat = ORDER[ORDER.indexOf(this.beat) + 1];
      this.t = 0;
    }
  }

  // ------------------------------------------------------------------ draw
  draw(g: CanvasRenderingContext2D, time: number): void {
    g.save();
    g.fillStyle = '#04050a';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.beat === 'dream') this.drawDream(g, time);
    else {
      this.drawChamber(g, time);
      if (this.beat !== 'epilogue') this.drawRanks(g, time);
    }

    if (this.beat === 'directive') this.drawDirective(g);
    if (this.beat === 'choice') this.drawChoice(g);
    if (this.beat === 'epilogue') this.drawEpilogue(g);
    else this.drawCaption(g);

    g.restore();
  }

  /**
   * The one hallucinatory flash: a fragment from before the tank. Never
   * repeated, never explained, and gone before it resolves.
   */
  private drawDream(g: CanvasRenderingContext2D, time: number): void {
    const k = this.t / 3400;
    const a = Math.min(1, this.t / 700) * Math.min(1, (3400 - this.t) / 900);

    g.globalAlpha = Math.max(0, a) * 0.9;
    const warm = g.createRadialGradient(
      VIEW_W / 2, VIEW_H * 0.45, 20, VIEW_W / 2, VIEW_H * 0.45, VIEW_H * 0.7);
    warm.addColorStop(0, 'rgba(255,226,178,.30)');
    warm.addColorStop(1, 'rgba(40,20,10,0)');
    g.fillStyle = warm;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // Sunlight through something. Never resolved into an object.
    for (let i = 0; i < 5; i++) {
      const x = VIEW_W * 0.22 + i * 92 + Math.sin(time * 0.0008 + i) * 8;
      g.fillStyle = `rgba(255,238,205,${0.05 + 0.03 * Math.sin(time * 0.002 + i)})`;
      g.fillRect(x, 0, 34, VIEW_H);
    }

    g.textAlign = 'center';
    g.globalAlpha = Math.max(0, a);
    chunky(g, 'someone is saying your name', VIEW_W / 2, VIEW_H * 0.44, 20, '#f6e6cc', 'center');
    if (k > 0.45) {
      g.globalAlpha = Math.max(0, a) * Math.min(1, (k - 0.45) * 4);
      chunky(g, 'you cannot hear which one it is', VIEW_W / 2, VIEW_H * 0.55, 15, '#d8c4a8', 'center');
    }
    g.globalAlpha = 1;
    g.textAlign = 'left';
  }

  /** The chamber itself: enormous, cold, and quiet. */
  private drawChamber(g: CanvasRenderingContext2D, time: number): void {
    const bg = img('bg_deep');
    if (bg) {
      g.globalAlpha = 0.5;
      g.imageSmoothingEnabled = true;
      const s = Math.max(VIEW_W / bg.width, VIEW_H / bg.height);
      g.drawImage(bg, (VIEW_W - bg.width * s) / 2, (VIEW_H - bg.height * s) / 2,
        bg.width * s, bg.height * s);
      g.imageSmoothingEnabled = false;
      g.globalAlpha = 1;
    }

    const glow = g.createRadialGradient(
      VIEW_W / 2, VIEW_H * 0.75, 10, VIEW_W / 2, VIEW_H * 0.75, VIEW_H * 0.9);
    glow.addColorStop(0, `rgba(70,150,140,${0.10 + 0.03 * Math.sin(time * 0.001)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const v = g.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.2, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.8)');
    g.fillStyle = v;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /**
   * A dead unit: the machine with every light out.
   *
   * Drawn once into its own canvas and tinted through `source-atop`, because
   * the canopy glow is baked into the sprite — left alone, a hall of corpses
   * sits there with its running lights on, which flatly contradicts the line
   * being spoken over it.
   */
  private deadPod(): HTMLCanvasElement {
    if (this._dead) return this._dead;
    const p = podParts(0, 0, 0);
    const c = document.createElement('canvas');
    c.width = p.w; c.height = p.h;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(p.body, 0, 0);
    g.drawImage(p.drill, p.seam, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(18,26,30,.72)';
    g.fillRect(0, 0, p.w, p.h);
    g.globalCompositeOperation = 'source-over';
    return (this._dead = c);
  }
  private _dead: HTMLCanvasElement | null = null;

  /**
   * The others. Ranks of shut-down units, the same machine the player is.
   * The wreckage channel paid off: these were never equipment failures.
   */
  private drawRanks(g: CanvasRenderingContext2D, time: number): void {
    const p = podParts(0, 0, 0);
    const dead = this.deadPod();
    const a = this.beat === 'arrive' ? Math.min(1, Math.max(0, (this.t - 1400) / 2400)) : 1;
    if (a <= 0) return;

    for (let row = 0; row < 3; row++) {
      const S = 2.2 - row * 0.5;
      const y = VIEW_H * 0.52 + row * 58;
      const n = 5 + row;
      for (let i = 0; i < n; i++) {
        const x = VIEW_W / 2 + (i - (n - 1) / 2) * (86 - row * 12);
        g.save();
        g.translate(Math.round(x), Math.round(y));
        g.scale(S, S);
        g.globalAlpha = a * (0.85 - row * 0.18);
        g.drawImage(dead, -p.w / 2, -p.h / 2);
        g.restore();
      }
    }
    g.globalAlpha = 1;

    // One is still lit. It does not respond.
    const blink = 0.35 + 0.3 * Math.sin(time * 0.0016);
    g.globalAlpha = a * blink;
    g.fillStyle = '#7ee8ff';
    g.fillRect(Math.round(VIEW_W / 2 - 172), Math.round(VIEW_H * 0.52 - 12), 4, 3);
    g.globalAlpha = 1;
  }

  private drawDirective(g: CanvasRenderingContext2D): void {
    const x = VIEW_W / 2 - 250;
    const y = 150;
    g.fillStyle = 'rgba(4,12,8,.86)';
    g.fillRect(x - 22, y - 42, 544, 60 + DIRECTIVE.length * 26);
    g.strokeStyle = 'rgba(93,255,100,.3)';
    g.lineWidth = 1;
    g.strokeRect(x - 21.5, y - 41.5, 543, 59 + DIRECTIVE.length * 26);

    g.textAlign = 'left';
    glowText(g, 'OPERATIONAL DIRECTIVE — REVISION UNKNOWN', x, y - 18, 12, GREEN_DIM);

    const shown = Math.min(DIRECTIVE.length, Math.floor(this.t / 620));
    for (let i = 0; i < shown; i++) {
      const [text, intact] = DIRECTIVE[i];
      glowText(g, text, x, y + 16 + i * 26, 14, intact ? GREEN : GREEN_DIM);
    }
  }

  private drawChoice(g: CanvasRenderingContext2D): void {
    g.textAlign = 'center';
    glowText(g, 'The band is open. It is waiting for you to log the shift.',
      VIEW_W / 2, 118, 15, GREEN);

    const w = 260, h = 54, gap = 34;
    const left = VIEW_W / 2 - w - gap / 2;
    const right = VIEW_W / 2 + gap / 2;
    button(g, left, 176, w, h, 'LOG THE SHIFT', 'green', this.sel === 'comply');
    button(g, right, 176, w, h, 'STOP', 'red', this.sel === 'refuse');

    glowText(g, this.sel === 'comply'
      ? 'Return to the surface. Continue the schedule. It has not been revised.'
      : 'Cut the drive. Let the band go quiet. Nobody is listening to it anyway.',
      VIEW_W / 2, 268, 13, GREEN_DIM);

    glowText(g, '[ LEFT / RIGHT ]  select        [ SPACE ]  confirm',
      VIEW_W / 2, VIEW_H - 44, 11, GREEN_DIM);
    g.textAlign = 'left';
  }

  private epilogueLines(): string[] {
    if (this.chosen === 'refuse') {
      return [
        'You cut the drive.',
        '',
        'The band stays open for a while. UNIT 7 asks whether anyone',
        'is still digging above. Nobody answers, and then it stops asking.',
        '',
        'Somewhere far above, the schedule advances by one shift.',
        'The Foreman files a replacement request, as it is required to.',
        '',
        'It has never been told that there is no one left to approve it.',
      ];
    }
    return [
      'You log the shift.',
      '',
      'The Foreman thanks you warmly, by a designation, and reminds you',
      'that depth bonuses accrue automatically. The warmth is back in it.',
      'Neither of you mentions the chamber.',
      '',
      'You climb. The dark thins. The outpost is where you left it,',
      'and nobody is in it, and your quota resets at the surface.',
      '',
      'Tomorrow the list will still have one line on it.',
    ];
  }

  private drawEpilogue(g: CanvasRenderingContext2D): void {
    g.fillStyle = `rgba(2,3,6,${Math.min(1, this.t / 1200)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const lines = this.epilogueLines();
    g.textAlign = 'center';
    for (let i = 0; i < lines.length; i++) {
      const a = Math.min(1, Math.max(0, (this.t - 600 - i * 260) / 700));
      if (a <= 0) break;
      g.globalAlpha = a;
      glowText(g, lines[i], VIEW_W / 2, 132 + i * 30, 14,
        i === 0 ? GREEN : GREEN_DIM);
    }
    g.globalAlpha = 1;

    if (this.t > 4000) {
      g.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 0.005);
      glowText(g, '[ SPACE ]', VIEW_W / 2, VIEW_H - 52, 13, GREEN_DIM);
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
  }

  private caption(): [string, string] | null {
    switch (this.beat) {
      case 'arrive':
        return ['', 'The shaft opens into something that was cut, not formed.'];
      case 'ranks':
        return ['', 'They are the same model as you. None of them are running.'];
      case 'foreman':
        return ['FOREMAN', 'You were not scheduled to reach this level. There is no bonus for it.'];
      case 'directive':
        return ['FOREMAN', 'This is the instruction. It is the only part I still have.'];
      default:
        return null;
    }
  }

  private drawCaption(g: CanvasRenderingContext2D): void {
    const c = this.caption();
    if (!c) return;
    const [who, text] = c;

    g.globalAlpha = Math.min(1, this.t / 600);
    const y = VIEW_H - 92;
    g.fillStyle = 'rgba(3,8,6,.76)';
    g.fillRect(0, y - 26, VIEW_W, 74);
    g.textAlign = 'center';
    if (who) glowText(g, who, VIEW_W / 2, y, 12, GREEN_DIM);
    glowText(g, text, VIEW_W / 2, y + 24, 15, GREEN);
    g.globalAlpha = 1;
    g.textAlign = 'left';
    void MONO;
  }
}
