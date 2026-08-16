export type Btn = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

const MAP: Record<string, Btn> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'confirm', Enter: 'confirm',
  Escape: 'cancel',
};

export class Input {
  private down = new Set<Btn>();
  private pressed = new Set<Btn>();
  /** Raw key codes pressed this frame, for cheat-code capture and menus. */
  readonly typed: string[] = [];

  constructor(target: EventTarget = window) {
    target.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat) return;
      const b = MAP[ev.code];
      if (b) {
        if (!this.down.has(b)) this.pressed.add(b);
        this.down.add(b);
        ev.preventDefault();
      }
      if (ev.key.length === 1) this.typed.push(ev.key.toLowerCase());
    });
    target.addEventListener('keyup', (e) => {
      const b = MAP[(e as KeyboardEvent).code];
      if (b) this.down.delete(b);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  held(b: Btn): boolean { return this.down.has(b); }
  justPressed(b: Btn): boolean { return this.pressed.has(b); }

  /** Call once at the end of each fixed update. */
  endFrame(): void { this.pressed.clear(); this.typed.length = 0; }

  /** Touch/virtual button support for the mobile build. */
  setVirtual(b: Btn, on: boolean): void {
    if (on) { if (!this.down.has(b)) this.pressed.add(b); this.down.add(b); }
    else this.down.delete(b);
  }
}
