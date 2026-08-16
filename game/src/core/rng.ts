/** Seeded RNG so a world can be reproduced from a seed string. */
export class Rng {
  private s: number;

  constructor(seed: number | string) {
    let h = 2166136261 >>> 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    this.s = h || 1;
  }

  /** xorshift32 */
  next(): number {
    let x = this.s;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    this.s = x;
    return x / 4294967296;
  }

  /** ActionScript's random(n): integer in [0, n). random(0) === 0. */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  range(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }
}
