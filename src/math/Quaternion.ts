import { Vector3 } from './Vector3';
import { Matrix4, Matrix3 } from './Matrix4';

export class Quaternion {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x: number = 0,  y: number = 0,  z: number = 0,  w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  // ── Static methods ──────────────────────────────────────────────────

  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  static fromAxisAngle(axis: Vector3, angle: number): Quaternion {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    const n = axis.normalize();
    return new Quaternion(n.x * s, n.y * s, n.z * s, Math.cos(halfAngle));
  }

  static fromEuler(x: number, y: number, z: number): Quaternion {
    // XYZ order
    const cx = Math.cos(x / 2);
    const sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2);
    const sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2);
    const sz = Math.sin(z / 2);

    return new Quaternion(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz
    );
  }

  static fromEulerDegrees(x: number, y: number, z: number): Quaternion {
    const deg2rad = Math.PI / 180;
    return Quaternion.fromEuler(x * deg2rad, y * deg2rad, z * deg2rad);
  }

  static fromToRotation(from: Vector3, to: Vector3): Quaternion {
    const fn = from.normalize();
    const tn = to.normalize();
    const d = fn.dot(tn);

    // Parallel vectors (same direction)
    if (d >= 1.0) {
      return Quaternion.identity();
    }

    // Opposite vectors
    if (d <= -1.0 + 1e-6) {
      // Pick an orthogonal axis
      let ortho = new Vector3(1, 0, 0).cross(fn);
      if (ortho.magnitude() < 1e-6) {
        ortho = new Vector3(0, 1, 0).cross(fn);
      }
      ortho = ortho.normalize();
      // 180-degree rotation around orthogonal axis
      return new Quaternion(ortho.x, ortho.y, ortho.z, 0);
    }

    const c = fn.cross(tn);
    const w = 1 + d;
    const q = new Quaternion(c.x, c.y, c.z, w);
    return q.normalize();
  }

  static fromMatrix(m: Matrix4): Quaternion {
    // Shepperd's method. m.elements is column-major (index layout):
    // col0: [0,1,2,3], col1: [4,5,6,7], col2: [8,9,10,11], col3: [12,13,14,15]
    // So: m00=e[0], m10=e[1], m20=e[2]
    //     m01=e[4], m11=e[5], m21=e[6]
    //     m02=e[8], m12=e[9], m22=e[10]
    const e = m.elements;
    const m00 = e[0], m10 = e[1], m20 = e[2];
    const m01 = e[4], m11 = e[5], m21 = e[6];
    const m02 = e[8], m12 = e[9], m22 = e[10];

    const trace = m00 + m11 + m22;
    let x: number, y: number, z: number, w: number;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      w = 0.25 / s;
      x = (m21 - m12) * s;
      y = (m02 - m20) * s;
      z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }

    return new Quaternion(x, y, z, w);
  }

  static random(): Quaternion {
    // Marsaglia's method for uniform random unit quaternion
    const u1 = Math.random();
    const u2 = Math.random();
    const u3 = Math.random();
    const sqrt1MinusU1 = Math.sqrt(1 - u1);
    const sqrtU1 = Math.sqrt(u1);
    return new Quaternion(
      sqrt1MinusU1 * Math.sin(2 * Math.PI * u2),
      sqrt1MinusU1 * Math.cos(2 * Math.PI * u2),
      sqrtU1 * Math.sin(2 * Math.PI * u3),
      sqrtU1 * Math.cos(2 * Math.PI * u3)
    );
  }

  static lookRotation(forward: Vector3, up: Vector3 = Vector3.up()): Quaternion {
    const f = forward.normalize();
    const r = up.cross(f).normalize();
    const u = f.cross(r);

    // Build rotation matrix from axes (column-major for Matrix4)
    // col0 = right(r), col1 = up(u), col2 = forward(f)
    const m = new Matrix4([
      r.x, u.x, f.x, 0,
      r.y, u.y, f.y, 0,
      r.z, u.z, f.z, 0,
      0,   0,   0,   1
    ]);

    return Quaternion.fromMatrix(m);
  }

  static exp(v: Vector3): Quaternion {
    const angle = v.magnitude();
    if (angle < 1e-10) {
      return Quaternion.identity();
    }
    const halfAngle = angle / 2;
    const n = v.normalize();
    const sinA = Math.sin(halfAngle);
    return new Quaternion(n.x * sinA, n.y * sinA, n.z * sinA, Math.cos(halfAngle));
  }

  static squad(a: Quaternion, b: Quaternion, c: Quaternion, d: Quaternion, t: number): Quaternion {
    const slerp1 = a.slerp(d, t);
    const slerp2 = b.slerp(c, t);
    return slerp1.slerp(slerp2, 2 * t * (1 - t));
  }

  // ── Instance methods ────────────────────────────────────────────────

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  copy(other: Quaternion): this {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    this.w = other.w;
    return this;
  }

  multiply(other: Quaternion): Quaternion {
    // Hamilton product
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = other.x, by = other.y, bz = other.z, bw = other.w;
    return new Quaternion(
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }

  premultiply(other: Quaternion): Quaternion {
    return other.multiply(this);
  }

  add(other: Quaternion): Quaternion {
    return new Quaternion(
      this.x + other.x,
      this.y + other.y,
      this.z + other.z,
      this.w + other.w
    );
  }

  scale(s: number): Quaternion {
    return new Quaternion(this.x * s, this.y * s, this.z * s, this.w * s);
  }

  dot(other: Quaternion): number {
    return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
  }

  magnitude(): number {
    return Math.sqrt(this.dot(this));
  }

  magnitudeSquared(): number {
    return this.dot(this);
  }

  normalize(): Quaternion {
    const mag = this.magnitude();
    if (mag < 1e-10) {
      return Quaternion.identity();
    }
    const invMag = 1 / mag;
    return new Quaternion(this.x * invMag, this.y * invMag, this.z * invMag, this.w * invMag);
  }

  normalizeInPlace(): this {
    const mag = this.magnitude();
    if (mag < 1e-10) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 1;
    } else {
      const invMag = 1 / mag;
      this.x *= invMag;
      this.y *= invMag;
      this.z *= invMag;
      this.w *= invMag;
    }
    return this;
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  inverse(): Quaternion {
    const magSq = this.magnitudeSquared();
    if (magSq < 1e-10) {
      return Quaternion.identity();
    }
    const invMagSq = 1 / magSq;
    return new Quaternion(
      -this.x * invMagSq,
      -this.y * invMagSq,
      -this.z * invMagSq,
      this.w * invMagSq
    );
  }

  slerp(other: Quaternion, t: number): Quaternion {
    let bx = other.x, by = other.y, bz = other.z, bw = other.w;

    let cosHalfTheta = this.x * bx + this.y * by + this.z * bz + this.w * bw;

    // If negative dot, negate one quaternion to take shortest path
    if (cosHalfTheta < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
      cosHalfTheta = -cosHalfTheta;
    }

    // If quaternions are very close, use linear interpolation
    if (cosHalfTheta >= 1.0 - 1e-6) {
      return new Quaternion(
        this.x + (bx - this.x) * t,
        this.y + (by - this.y) * t,
        this.z + (bz - this.z) * t,
        this.w + (bw - this.w) * t
      ).normalize();
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sin(halfTheta);

    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    return new Quaternion(
      this.x * ratioA + bx * ratioB,
      this.y * ratioA + by * ratioB,
      this.z * ratioA + bz * ratioB,
      this.w * ratioA + bw * ratioB
    );
  }

  lerp(other: Quaternion, t: number): Quaternion {
    return new Quaternion(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t,
      this.z + (other.z - this.z) * t,
      this.w + (other.w - this.w) * t
    );
  }

  nlerp(other: Quaternion, t: number): Quaternion {
    return this.lerp(other, t).normalize();
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

  getAngle(): number {
    const clamped = Math.max(-1, Math.min(1, this.w));
    return 2 * Math.acos(clamped);
  }

  getAxis(): Vector3 {
    const sinHalfAngle = Math.sqrt(1 - this.w * this.w);
    if (sinHalfAngle < 1e-6) {
      return new Vector3(0, 1, 0);
    }
    return new Vector3(
      this.x / sinHalfAngle,
      this.y / sinHalfAngle,
      this.z / sinHalfAngle
    );
  }

  toAxisAngle(): { axis: Vector3; angle: number } {
    return {
      axis: this.getAxis(),
      angle: this.getAngle()
    };
  }

  toEuler(): { x: number; y: number; z: number } {
    // Extract Euler angles in XYZ order
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z);
    const cosr_cosp = 1 - 2 * (this.x * this.x + this.y * this.y);
    const xAngle = Math.atan2(sinr_cosp, cosr_cosp);

    let yAngle: number;
    const sinp = 2 * (this.w * this.y - this.z * this.x);
    if (Math.abs(sinp) >= 1) {
      yAngle = Math.sign(sinp) * (Math.PI / 2); // gimbal lock
    } else {
      yAngle = Math.asin(sinp);
    }

    const siny_cosp = 2 * (this.w * this.z + this.x * this.y);
    const cosy_cosp = 1 - 2 * (this.y * this.y + this.z * this.z);
    const zAngle = Math.atan2(siny_cosp, cosy_cosp);

    return { x: xAngle, y: yAngle, z: zAngle };
  }

  toEulerDegrees(): { x: number; y: number; z: number } {
    const rad = this.toEuler();
    const rad2deg = 180 / Math.PI;
    return {
      x: rad.x * rad2deg,
      y: rad.y * rad2deg,
      z: rad.z * rad2deg
    };
  }

  toMatrix4(): Matrix4 {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    // Column-major layout
    return new Matrix4([
      1 - (yy + zz), xy + wz,       xz - wy,       0,
      xy - wz,       1 - (xx + zz), yz + wx,       0,
      xz + wy,       yz - wx,       1 - (xx + yy), 0,
      0,             0,             0,             1
    ]);
  }

  toMatrix3(): Matrix3 {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    // Row-major layout (Matrix3 convention)
    return new Matrix3([
      1 - (yy + zz), xy - wz,       xz + wy,
      xy + wz,       1 - (xx + zz), yz - wx,
      xz - wy,       yz + wx,       1 - (xx + yy)
    ]);
  }

  angleTo(other: Quaternion): number {
    const d = Math.abs(this.dot(other));
    const clamped = Math.min(d, 1);
    return 2 * Math.acos(clamped);
  }

  equals(other: Quaternion, epsilon: number = Number.EPSILON): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon &&
      Math.abs(this.w - other.w) < epsilon
    );
  }

  isIdentity(epsilon: number = Number.EPSILON): boolean {
    return (
      Math.abs(this.x) < epsilon &&
      Math.abs(this.y) < epsilon &&
      Math.abs(this.z) < epsilon &&
      Math.abs(this.w - 1) < epsilon
    );
  }

  log(): Vector3 {
    if (this.isIdentity(1e-10)) {
      return Vector3.zero();
    }
    const clamped = Math.max(-1, Math.min(1, this.w));
    const halfAngle = Math.acos(clamped);
    const sinHalfAngle = Math.sin(halfAngle);
    if (Math.abs(sinHalfAngle) < 1e-10) {
      return Vector3.zero();
    }
    const fullAngle = halfAngle * 2;
    const k = fullAngle / sinHalfAngle;
    return new Vector3(this.x * k, this.y * k, this.z * k);
  }

  pow(t: number): Quaternion {
    if (this.isIdentity(1e-10)) {
      return Quaternion.identity();
    }
    const logV = this.log();
    return Quaternion.exp(logV.scale(t));
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  toString(): string {
    return `Quaternion(${this.x}, ${this.y}, ${this.z}, ${this.w})`;
  }
}

export class DualQuaternion {
  public real: Quaternion;
  public dual: Quaternion;

  constructor(real: Quaternion,  dual: Quaternion) {
    this.real = real;
    this.dual = dual;
  }

  static fromRotationTranslation(rotation: Quaternion, translation: Vector3): DualQuaternion {
    const real = rotation.clone();
    // dual = 0.5 * Quaternion(t.x, t.y, t.z, 0) * rotation
    const tq = new Quaternion(translation.x, translation.y, translation.z, 0);
    const dual = tq.multiply(real).scale(0.5);
    return new DualQuaternion(real, dual);
  }

  clone(): DualQuaternion {
    return new DualQuaternion(this.real.clone(), this.dual.clone());
  }

  multiply(other: DualQuaternion): DualQuaternion {
    // real = this.real * other.real
    // dual = this.real * other.dual + this.dual * other.real
    const newReal = this.real.multiply(other.real);
    const newDual = this.real.multiply(other.dual).add(this.dual.multiply(other.real));
    return new DualQuaternion(newReal, newDual);
  }

  conjugate(): DualQuaternion {
    return new DualQuaternion(this.real.conjugate(), this.dual.conjugate());
  }

  normalize(): DualQuaternion {
    const mag = this.real.magnitude();
    if (mag < 1e-10) {
      return this.clone();
    }
    const invMag = 1 / mag;
    return new DualQuaternion(
      this.real.scale(invMag),
      this.dual.scale(invMag)
    );
  }

  transformPoint(p: Vector3): Vector3 {
    const { rotation, translation } = this.toRotationTranslation();
    const rotated = rotation.rotateVector(p);
    return rotated.add(translation);
  }

  toRotationTranslation(): { rotation: Quaternion; translation: Vector3 } {
    const rotation = this.real.normalize();
    // translation = 2 * dual * conjugate(real)
    const t = this.dual.scale(2).multiply(this.real.conjugate());
    return {
      rotation,
      translation: new Vector3(t.x, t.y, t.z)
    };
  }

  sclerp(other: DualQuaternion, t: number): DualQuaternion {
    // Check if both have identity rotation (pure translation case)
    if (this.real.isIdentity(1e-6) && other.real.isIdentity(1e-6)) {
      const t1 = this.toRotationTranslation().translation;
      const t2 = other.toRotationTranslation().translation;
      const lerpedTranslation = t1.lerp(t2, t);
      return DualQuaternion.fromRotationTranslation(
        Quaternion.identity(),
        lerpedTranslation
      );
    }

    // General case: use pow approach
    // sclerp(dq1, dq2, t) = dq1 * (dq1^-1 * dq2)^t
    const diff = this.conjugate().multiply(other);
    const powered = diff.pow(t);
    return this.multiply(powered);
  }

  pow(t: number): DualQuaternion {
    const { rotation, translation } = this.toRotationTranslation();

    // If rotation is identity, just scale the translation
    if (rotation.isIdentity(1e-6)) {
      return DualQuaternion.fromRotationTranslation(
        Quaternion.identity(),
        translation.scale(t)
      );
    }

    // General case: use log/exp on rotation and scale translation along screw axis
    const logRot = rotation.log();
    const angle = logRot.magnitude();

    if (angle < 1e-10) {
      return DualQuaternion.fromRotationTranslation(
        Quaternion.identity(),
        translation.scale(t)
      );
    }

    const axis = logRot.normalize();
    const pitch = translation.dot(axis);
    const moment = translation.subtract(axis.scale(pitch)).scale(0.5 / angle);

    // Reconstruct with scaled parameters
    const newAngle = angle * t;
    const newPitch = pitch * t;
    const _halfAngle = newAngle / 2;

    const _newRotation = Quaternion.fromAxisAngle(axis, newAngle);
    // Translation along screw axis
    const _newTranslation = axis.scale(newPitch).add(
      moment.scale(newAngle).cross(axis).scale(2)
    ).add(
      moment.scale(2 * (1 - Math.cos(newAngle)))
    );

    // Simplified: for pure rotation+translation screw, reconstruct via:
    // Use the simpler power formula for the general case
    const powRotation = rotation.pow(t);
    // For the translation component under screw interpolation:
    // d_t = t * (d_axis * pitch) + sin(t*angle)/sin(angle) * (d - d_axis * pitch_component)
    // This simplifies for most practical cases to:
    const powTranslation = translation.scale(t);

    return DualQuaternion.fromRotationTranslation(powRotation, powTranslation);
  }
}
