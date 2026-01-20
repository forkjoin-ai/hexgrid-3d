import { Vector3 } from './Vector3';

export class Matrix4 {
  private elements: number[];

  constructor(elements?: number[]) {
    this.elements = elements ?? Matrix4.identity().elements;
  }

  static identity(): Matrix4 {
    return new Matrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static translation(x: number, y: number, z: number): Matrix4 {
    return new Matrix4([
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1,
    ]);
  }

  transformPoint(point: Vector3): Vector3 {
    const e = this.elements;
    const x = point.x * e[0] + point.y * e[1] + point.z * e[2] + e[3];
    const y = point.x * e[4] + point.y * e[5] + point.z * e[6] + e[7];
    const z = point.x * e[8] + point.y * e[9] + point.z * e[10] + e[11];
    return new Vector3(x, y, z);
  }
}
