import { Vector3 } from './Vector3';

/**
 * 4x4 matrix using column-major storage (OpenGL convention).
 *
 * Memory layout (16-element array):
 * | e[0]  e[4]  e[8]  e[12] |
 * | e[1]  e[5]  e[9]  e[13] |
 * | e[2]  e[6]  e[10] e[14] |
 * | e[3]  e[7]  e[11] e[15] |
 */
export class Matrix4 {
  public elements: number[];

  constructor(elements?: number[]) {
    if (elements) {
      this.elements = elements.slice();
    } else {
      this.elements = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ];
    }
  }

  // ---------------------------------------------------------------------------
  // Static factory methods
  // ---------------------------------------------------------------------------

  static identity(): Matrix4 {
    return new Matrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  static zero(): Matrix4 {
    return new Matrix4([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
  }

  static translation(x: number, y: number, z: number): Matrix4 {
    return new Matrix4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]);
  }

  static translationFromVector(v: Vector3): Matrix4 {
    return Matrix4.translation(v.x, v.y, v.z);
  }

  static scale(x: number, y: number, z: number): Matrix4 {
    return new Matrix4([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  }

  static uniformScale(s: number): Matrix4 {
    return Matrix4.scale(s, s, s);
  }

  /**
   * Rotation around the X axis.
   * Column-major: [5]=cos, [6]=sin, [9]=-sin, [10]=cos
   */
  static rotationX(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Rotation around the Y axis.
   * Column-major: [0]=cos, [2]=-sin, [8]=sin, [10]=cos
   */
  static rotationY(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Rotation around the Z axis.
   * Column-major: [0]=cos, [1]=sin, [4]=-sin, [5]=cos
   */
  static rotationZ(angle: number): Matrix4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Matrix4([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Rotation around an arbitrary axis using Rodrigues' rotation formula.
   */
  static rotationAxis(axis: Vector3, angle: number): Matrix4 {
    const a = axis.normalize();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const x = a.x;
    const y = a.y;
    const z = a.z;

    return new Matrix4([
      t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
      0,                 0,                  0,                  1,
    ]);
  }

  /**
   * Compose rotation from Euler angles: R = Rx * Ry * Rz
   */
  static rotationEuler(x: number, y: number, z: number): Matrix4 {
    return Matrix4.rotationX(x).multiply(Matrix4.rotationY(y)).multiply(Matrix4.rotationZ(z));
  }

  /**
   * Perspective projection matrix.
   * elements[11] = -1, elements[15] = 0
   */
  static perspective(fov: number, aspect: number, near: number, far: number): Matrix4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (near - far);

    return new Matrix4([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, 2 * near * far * rangeInv, 0,
    ]);
  }

  /**
   * Orthographic projection matrix.
   * elements[15] = 1
   */
  static orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): Matrix4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    return new Matrix4([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
  }

  /**
   * Look-at view matrix.
   * elements[15] = 1
   */
  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const zAxis = eye.subtract(target).normalize();  // forward (camera looks down -z)
    const xAxis = up.cross(zAxis).normalize();       // right
    const yAxis = zAxis.cross(xAxis);                // recalculated up

    return new Matrix4([
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -xAxis.dot(eye), -yAxis.dot(eye), -zAxis.dot(eye), 1,
    ]);
  }

  /**
   * Compose a TRS (Translation * Rotation * Scale) matrix.
   * elements[12]=t.x, elements[0]=s.x*R[0], etc.
   */
  static compose(translation: Vector3, rotation: Matrix4, scale: Vector3): Matrix4 {
    const r = rotation.elements;
    const sx = scale.x;
    const sy = scale.y;
    const sz = scale.z;

    return new Matrix4([
      r[0] * sx, r[1] * sx, r[2] * sx, 0,
      r[4] * sy, r[5] * sy, r[6] * sy, 0,
      r[8] * sz, r[9] * sz, r[10] * sz, 0,
      translation.x, translation.y, translation.z, 1,
    ]);
  }

  // ---------------------------------------------------------------------------
  // Instance methods
  // ---------------------------------------------------------------------------

  clone(): Matrix4 {
    return new Matrix4(this.elements.slice());
  }

  copy(other: Matrix4): this {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = other.elements[i];
    }
    return this;
  }

  /**
   * Column-major matrix multiplication: this * other.
   *
   * Result column j = this * column j of other.
   */
  multiply(other: Matrix4): Matrix4 {
    const a = this.elements;
    const b = other.elements;
    const out = new Array<number>(16);

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[row]      * b[col * 4]     +
          a[4 + row]  * b[col * 4 + 1] +
          a[8 + row]  * b[col * 4 + 2] +
          a[12 + row] * b[col * 4 + 3];
      }
    }

    return new Matrix4(out);
  }

  /**
   * Premultiply: other * this
   */
  premultiply(other: Matrix4): Matrix4 {
    return other.multiply(this);
  }

  /**
   * Transform a point (applies full matrix including translation).
   * Column-major: x = e[0]*vx + e[4]*vy + e[8]*vz + e[12]
   */
  transformPoint(v: Vector3): Vector3 {
    const e = this.elements;
    return new Vector3(
      e[0] * v.x + e[4] * v.y + e[8]  * v.z + e[12],
      e[1] * v.x + e[5] * v.y + e[9]  * v.z + e[13],
      e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14],
    );
  }

  /**
   * Transform a direction vector (no translation applied).
   */
  transformDirection(v: Vector3): Vector3 {
    const e = this.elements;
    return new Vector3(
      e[0] * v.x + e[4] * v.y + e[8]  * v.z,
      e[1] * v.x + e[5] * v.y + e[9]  * v.z,
      e[2] * v.x + e[6] * v.y + e[10] * v.z,
    );
  }

  /**
   * Transform a normal vector by the inverse transpose of the upper-left 3x3.
   * Result is normalized.
   */
  transformNormal(v: Vector3): Vector3 {
    const inv = this.inverse();
    if (!inv) {
      return v.clone();
    }
    // Multiply by the transpose of the inverse: use rows of inv instead of columns
    const e = inv.elements;
    const result = new Vector3(
      e[0] * v.x + e[1] * v.y + e[2]  * v.z,
      e[4] * v.x + e[5] * v.y + e[6]  * v.z,
      e[8] * v.x + e[9] * v.y + e[10] * v.z,
    );
    return result.normalize();
  }

  /**
   * Transform an array of points.
   */
  transformPoints(points: Vector3[]): Vector3[] {
    return points.map((p) => this.transformPoint(p));
  }

  /**
   * 4x4 determinant computed via cofactor expansion.
   */
  determinant(): number {
    const e = this.elements;

    const a00 = e[0],  a01 = e[4],  a02 = e[8],  a03 = e[12];
    const a10 = e[1],  a11 = e[5],  a12 = e[9],  a13 = e[13];
    const a20 = e[2],  a21 = e[6],  a22 = e[10], a23 = e[14];
    const a30 = e[3],  a31 = e[7],  a32 = e[11], a33 = e[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  }

  /**
   * Compute the inverse. Returns null if the matrix is singular (determinant ~ 0).
   */
  inverse(): Matrix4 | null {
    const e = this.elements;

    const a00 = e[0],  a01 = e[4],  a02 = e[8],  a03 = e[12];
    const a10 = e[1],  a11 = e[5],  a12 = e[9],  a13 = e[13];
    const a20 = e[2],  a21 = e[6],  a22 = e[10], a23 = e[14];
    const a30 = e[3],  a31 = e[7],  a32 = e[11], a33 = e[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (Math.abs(det) < 1e-10) {
      return null;
    }

    const invDet = 1.0 / det;

    return new Matrix4([
      ( a11 * b11 - a12 * b10 + a13 * b09) * invDet,
      (-a10 * b11 + a12 * b08 - a13 * b07) * invDet,
      ( a10 * b10 - a11 * b08 + a13 * b06) * invDet,
      (-a10 * b09 + a11 * b07 - a12 * b06) * invDet,
      (-a01 * b11 + a02 * b10 - a03 * b09) * invDet,
      ( a00 * b11 - a02 * b08 + a03 * b07) * invDet,
      (-a00 * b10 + a01 * b08 - a03 * b06) * invDet,
      ( a00 * b09 - a01 * b07 + a02 * b06) * invDet,
      ( a31 * b05 - a32 * b04 + a33 * b03) * invDet,
      (-a30 * b05 + a32 * b02 - a33 * b01) * invDet,
      ( a30 * b04 - a31 * b02 + a33 * b00) * invDet,
      (-a30 * b03 + a31 * b01 - a32 * b00) * invDet,
      (-a21 * b05 + a22 * b04 - a23 * b03) * invDet,
      ( a20 * b05 - a22 * b02 + a23 * b01) * invDet,
      (-a20 * b04 + a21 * b02 - a23 * b00) * invDet,
      ( a20 * b03 - a21 * b01 + a22 * b00) * invDet,
    ]);
  }

  /**
   * Transpose this matrix (swap rows and columns).
   */
  transpose(): Matrix4 {
    const e = this.elements;
    return new Matrix4([
      e[0], e[4], e[8],  e[12],
      e[1], e[5], e[9],  e[13],
      e[2], e[6], e[10], e[14],
      e[3], e[7], e[11], e[15],
    ]);
  }

  /**
   * Extract the translation component.
   */
  getTranslation(): Vector3 {
    return new Vector3(this.elements[12], this.elements[13], this.elements[14]);
  }

  /**
   * Extract the scale by computing the length of each column.
   */
  getScale(): Vector3 {
    const e = this.elements;
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);
    const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
    return new Vector3(sx, sy, sz);
  }

  /**
   * Extract the rotation matrix (scale removed, translation zeroed).
   */
  getRotationMatrix(): Matrix4 {
    const e = this.elements;
    const scale = this.getScale();

    const invSx = scale.x !== 0 ? 1 / scale.x : 0;
    const invSy = scale.y !== 0 ? 1 / scale.y : 0;
    const invSz = scale.z !== 0 ? 1 / scale.z : 0;

    return new Matrix4([
      e[0] * invSx, e[1] * invSx, e[2] * invSx, 0,
      e[4] * invSy, e[5] * invSy, e[6] * invSy, 0,
      e[8] * invSz, e[9] * invSz, e[10] * invSz, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Decompose into translation, scale, and rotation components.
   */
  decompose(): { translation: Vector3; scale: Vector3; rotation: Matrix4 } {
    return {
      translation: this.getTranslation(),
      scale: this.getScale(),
      rotation: this.getRotationMatrix(),
    };
  }

  /**
   * Element-wise linear interpolation between this and other.
   */
  lerp(other: Matrix4, t: number): Matrix4 {
    const a = this.elements;
    const b = other.elements;
    const out = new Array<number>(16);
    for (let i = 0; i < 16; i++) {
      out[i] = a[i] + (b[i] - a[i]) * t;
    }
    return new Matrix4(out);
  }

  /**
   * Element-wise equality check with optional epsilon.
   */
  equals(other: Matrix4, epsilon: number = Number.EPSILON): boolean {
    for (let i = 0; i < 16; i++) {
      if (Math.abs(this.elements[i] - other.elements[i]) >= epsilon) {
        return false;
      }
    }
    return true;
  }

  /**
   * Return a copy of the elements array.
   */
  toArray(): number[] {
    return this.elements.slice();
  }

  /**
   * String representation with 4 decimal places.
   */
  toString(): string {
    const formatted = this.elements.map((v) => v.toFixed(4));
    return `Matrix4([${formatted.join(', ')}])`;
  }
}

/**
 * 3x3 matrix using row-major storage.
 *
 * Layout:
 * | e[0] e[1] e[2] |
 * | e[3] e[4] e[5] |
 * | e[6] e[7] e[8] |
 */
export class Matrix3 {
  public elements: number[];

  constructor(elements?: number[]) {
    if (elements) {
      this.elements = elements.slice();
    } else {
      this.elements = [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ];
    }
  }

  static identity(): Matrix3 {
    return new Matrix3([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  }

  /**
   * Extract the upper-left 3x3 from a column-major Matrix4 into a row-major Matrix3.
   *
   * Mapping:
   *   m3[0]=m4[0], m3[1]=m4[4], m3[2]=m4[8]
   *   m3[3]=m4[1], m3[4]=m4[5], m3[5]=m4[9]
   *   m3[6]=m4[2], m3[7]=m4[6], m3[8]=m4[10]
   */
  static fromMatrix4(m4: Matrix4): Matrix3 {
    const e = m4.elements;
    return new Matrix3([
      e[0], e[4], e[8],
      e[1], e[5], e[9],
      e[2], e[6], e[10],
    ]);
  }

  clone(): Matrix3 {
    return new Matrix3(this.elements.slice());
  }

  /**
   * Row-major 3x3 multiplication: this * other.
   */
  multiply(other: Matrix3): Matrix3 {
    const a = this.elements;
    const b = other.elements;

    return new Matrix3([
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
      a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
      a[0] * b[2] + a[1] * b[5] + a[2] * b[8],

      a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
      a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
      a[3] * b[2] + a[4] * b[5] + a[5] * b[8],

      a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
      a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
      a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ]);
  }

  /**
   * Transform a Vector3 using row-major convention:
   * x = e[0]*vx + e[1]*vy + e[2]*vz
   */
  transformVector(v: Vector3): Vector3 {
    const e = this.elements;
    return new Vector3(
      e[0] * v.x + e[1] * v.y + e[2] * v.z,
      e[3] * v.x + e[4] * v.y + e[5] * v.z,
      e[6] * v.x + e[7] * v.y + e[8] * v.z,
    );
  }

  /**
   * 3x3 determinant.
   */
  determinant(): number {
    const e = this.elements;
    return (
      e[0] * (e[4] * e[8] - e[5] * e[7]) -
      e[1] * (e[3] * e[8] - e[5] * e[6]) +
      e[2] * (e[3] * e[7] - e[4] * e[6])
    );
  }

  /**
   * Compute the inverse. Returns null if the matrix is singular.
   */
  inverse(): Matrix3 | null {
    const e = this.elements;
    const det = this.determinant();

    if (Math.abs(det) < 1e-10) {
      return null;
    }

    const invDet = 1.0 / det;

    return new Matrix3([
      (e[4] * e[8] - e[5] * e[7]) * invDet,
      (e[2] * e[7] - e[1] * e[8]) * invDet,
      (e[1] * e[5] - e[2] * e[4]) * invDet,

      (e[5] * e[6] - e[3] * e[8]) * invDet,
      (e[0] * e[8] - e[2] * e[6]) * invDet,
      (e[2] * e[3] - e[0] * e[5]) * invDet,

      (e[3] * e[7] - e[4] * e[6]) * invDet,
      (e[1] * e[6] - e[0] * e[7]) * invDet,
      (e[0] * e[4] - e[1] * e[3]) * invDet,
    ]);
  }

  /**
   * Transpose the 3x3 matrix.
   */
  transpose(): Matrix3 {
    const e = this.elements;
    return new Matrix3([
      e[0], e[3], e[6],
      e[1], e[4], e[7],
      e[2], e[5], e[8],
    ]);
  }
}
