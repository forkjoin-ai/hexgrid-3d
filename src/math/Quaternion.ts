import { Vector3 } from './Vector3';

export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  rotateVector(vector: Vector3): Vector3 {
    const qx = this.x;
    const qy = this.y;
    const qz = this.z;
    const qw = this.w;

    const ix = qw * vector.x + qy * vector.z - qz * vector.y;
    const iy = qw * vector.y + qz * vector.x - qx * vector.z;
    const iz = qw * vector.z + qx * vector.y - qy * vector.x;
    const iw = -qx * vector.x - qy * vector.y - qz * vector.z;

    return new Vector3(
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx
    );
  }
}
