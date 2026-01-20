export class Axial {
  q: number;
  r: number;

  constructor(q: number, r: number) {
    this.q = q;
    this.r = r;
  }

  static fromPixel(x: number, y: number, hexSize: number): Axial {
    const q = (Math.sqrt(3) / 3 * x - (1 / 3) * y) / hexSize;
    const r = ((2 / 3) * y) / hexSize;
    return new Axial(Math.round(q), Math.round(r));
  }
}
