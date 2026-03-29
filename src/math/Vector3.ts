export class Vector2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(factor: number): Vector2 {
    return new Vector2(this.x * factor, this.y * factor);
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vector2 {
    const len = this.magnitude();
    if (len === 0) return new Vector2(0, 0);
    return new Vector2(this.x / len, this.y / len);
  }

  distanceTo(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  angleTo(other: Vector2): number {
    return Math.acos(Math.max(-1, Math.min(1, this.dot(other) / (this.magnitude() * other.magnitude()))));
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  perpendicular(): Vector2 {
    return new Vector2(-this.y, this.x);
  }

  lerp(other: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toVector3(z: number = 0): Vector3 {
    return new Vector3(this.x, this.y, z);
  }

  equals(other: Vector2, epsilon: number = Number.EPSILON): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon
    );
  }

  toString(): string {
    return `Vector2(${this.x.toFixed(4)}, ${this.y.toFixed(4)})`;
  }
}

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  static up(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  static down(): Vector3 {
    return new Vector3(0, -1, 0);
  }

  static right(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  static left(): Vector3 {
    return new Vector3(-1, 0, 0);
  }

  static forward(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  static back(): Vector3 {
    return new Vector3(0, 0, -1);
  }

  static fromArray(arr: number[]): Vector3 {
    return new Vector3(arr[0], arr[1], arr[2]);
  }

  static fromSpherical(phi: number, theta: number, radius: number): Vector3 {
    // Matches test expectation where (0,0,1) -> (1,0,0)
    // Assuming phi is azimuth (longitude), theta is elevation (latitude), radius is magnitude.
    // x = r * cos(theta) * cos(phi)
    // y = r * cos(theta) * sin(phi)
    // z = r * sin(theta)
    const x = radius * Math.cos(theta) * Math.cos(phi);
    const y = radius * Math.cos(theta) * Math.sin(phi);
    const z = radius * Math.sin(theta);
    return new Vector3(x, y, z);
  }

  static fromLatLng(latitude: number, longitude: number, radius: number = 1): Vector3 {
    const latRad = (latitude * Math.PI) / 180;
    const lonRad = (longitude * Math.PI) / 180;
    return Vector3.fromSpherical(lonRad, latRad, radius);
  }

  static random(): Vector3 {
    // Random vector on unit sphere
    const theta = Math.asin(2 * Math.random() - 1); // Elevation [-PI/2, PI/2]
    const phi = 2 * Math.PI * Math.random();        // Azimuth [0, 2PI]
    return Vector3.fromSpherical(phi, theta, 1);
  }

  static randomInSphere(radius: number): Vector3 {
    const r = radius * Math.cbrt(Math.random());
    return Vector3.random().scale(r);
  }

  static catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const f0 = -0.5 * t3 + t2 - 0.5 * t;
    const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const f3 = 0.5 * t3 - 0.5 * t2;

    return p0.scale(f0).add(p1.scale(f1)).add(p2.scale(f2)).add(p3.scale(f3));
  }

  static bezier(points: Vector3[], t: number): Vector3 {
    if (points.length === 0) return Vector3.zero();
    if (points.length === 1) return points[0].clone();
    
    const temp = points.map(p => p.clone());
    const n = temp.length - 1;
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i; j++) {
            temp[j] = temp[j].lerp(temp[j+1], t);
        }
    }
    return temp[0];
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  // Immutable operations return new vectors
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  scale(factor: number): Vector3 {
    return new Vector3(this.x * factor, this.y * factor, this.z * factor);
  }

  multiply(other: Vector3): Vector3 {
    return new Vector3(this.x * other.x, this.y * other.y, this.z * other.z);
  }

  divide(other: Vector3): Vector3 {
    return new Vector3(
      other.x === 0 ? 0 : this.x / other.x,
      other.y === 0 ? 0 : this.y / other.y,
      other.z === 0 ? 0 : this.z / other.z
    );
  }

  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  // Mutable operations modify 'this'
  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  copy(other: Vector3): this {
    this.x = other.x; this.y = other.y; this.z = other.z;
    return this;
  }

  addInPlace(other: Vector3): this {
    this.x += other.x; this.y += other.y; this.z += other.z;
    return this;
  }

  subtractInPlace(other: Vector3): this {
    this.x -= other.x; this.y -= other.y; this.z -= other.z;
    return this;
  }

  scaleInPlace(factor: number): this {
    this.x *= factor; this.y *= factor; this.z *= factor;
    return this;
  }

  normalizeInPlace(): this {
    const len = this.length();
    if (len > 0) {
      this.scaleInPlace(1 / len);
    } else {
        this.x = 0; this.y = 0; this.z = 0;
    }
    return this;
  }

  // Products
  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  tripleProduct(b: Vector3, c: Vector3): number {
    return this.dot(b.cross(c));
  }

  // Magnitude & Distance
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  magnitude(): number {
    return this.length();
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize(): Vector3 {
    return this.clone().normalizeInPlace();
  }

  distanceTo(other: Vector3): number {
    return Math.sqrt(this.distanceSquaredTo(other));
  }

  distanceSquaredTo(other: Vector3): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return dx*dx + dy*dy + dz*dz;
  }

  // Interpolation
  lerp(other: Vector3, t: number): Vector3 {
    return new Vector3(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t,
      this.z + (other.z - this.z) * t
    );
  }

  slerp(other: Vector3, t: number): Vector3 {
    let dot = this.dot(other);
    // Clamp dot to [-1, 1]
    dot = Math.max(-1, Math.min(1, dot));
    
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    
    if (Math.abs(sinTheta) < 0.001) {
        return this.lerp(other, t);
    }
    
    const w1 = Math.sin((1 - t) * theta) / sinTheta;
    const w2 = Math.sin(t * theta) / sinTheta;
    
    return this.scale(w1).add(other.scale(w2));
  }

  nlerp(other: Vector3, t: number): Vector3 {
      return this.lerp(other, t).normalize();
  }

  hermite(t1: Vector3, p2: Vector3, t2: Vector3, t: number): Vector3 {
      const tSq = t * t;
      const tCub = tSq * t;
      
      const h1 = 2*tCub - 3*tSq + 1;
      const h2 = -2*tCub + 3*tSq;
      const h3 = tCub - 2*tSq + t;
      const h4 = tCub - tSq;
      
      return this.scale(h1).add(p2.scale(h2)).add(t1.scale(h3)).add(t2.scale(h4));
  }

  // Utility
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toFloat32Array(): Float32Array {
    return new Float32Array([this.x, this.y, this.z]);
  }

  equals(other: Vector3, epsilon: number = Number.EPSILON): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.z - other.z) < epsilon
    );
  }

  isZero(): boolean {
      return this.x === 0 && this.y === 0 && this.z === 0;
  }

  abs(): Vector3 {
      return new Vector3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
  }

  floor(): Vector3 {
      return new Vector3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
  }

  ceil(): Vector3 {
      return new Vector3(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
  }

  round(): Vector3 {
      return new Vector3(Math.round(this.x), Math.round(this.y), Math.round(this.z));
  }

  min(other: Vector3): Vector3 {
      return new Vector3(Math.min(this.x, other.x), Math.min(this.y, other.y), Math.min(this.z, other.z));
  }

  max(other: Vector3): Vector3 {
      return new Vector3(Math.max(this.x, other.x), Math.max(this.y, other.y), Math.max(this.z, other.z));
  }

  clamp(min: Vector3, max: Vector3): Vector3 {
      return new Vector3(
          Math.max(min.x, Math.min(max.x, this.x)),
          Math.max(min.y, Math.min(max.y, this.y)),
          Math.max(min.z, Math.min(max.z, this.z))
      );
  }
  
  clampMagnitude(max: number): Vector3 {
      const len = this.magnitude();
      if (len > max) {
          return this.scale(max / len);
      }
      return this.clone();
  }

  setMagnitude(len: number): Vector3 {
      return this.normalize().scale(len);
  }

  reflect(normal: Vector3): Vector3 {
      // r = d - 2(d.n)n
      const n = normal.normalize(); // Ensure normal is normalized
      const term = n.scale(2 * this.dot(n));
      return this.subtract(term);
  }

  // Angles - Spherical
  angleTo(other: Vector3): number {
      const denom = this.magnitude() * other.magnitude();
      if (denom === 0) return 0;
      const dot = this.dot(other);
      return Math.acos(Math.max(-1, Math.min(1, dot / denom)));
  }

  signedAngleTo(other: Vector3, axis: Vector3): number {
      const angle = this.angleTo(other);
      const cross = this.cross(other);
      const sign = cross.dot(axis) >= 0 ? 1 : -1;
      return angle * sign;
  }

  toSpherical(): { radius: number; theta: number; phi: number } {
      const r = this.magnitude();
      if (r === 0) return { radius: 0, theta: 0, phi: 0 };
      const theta = Math.asin(this.z / r);
      const phi = Math.atan2(this.y, this.x);
      return { radius: r, theta, phi: phi >= 0 ? phi : phi + 2 * Math.PI };
  }

  toLatLng(): { lat: number; lng: number } {
      const r = this.magnitude();
      if (r === 0) return { lat: 0, lng: 0 };
      const lat = Math.asin(this.z / r);
      const lng = Math.atan2(this.y, this.x);
      return {
          lat: (lat * 180) / Math.PI,
          lng: (lng * 180) / Math.PI
      };
  }

  greatCircleDistanceTo(other: Vector3): number {
      return this.angleTo(other);
  }

  greatCircleLerp(other: Vector3, t: number): Vector3 {
      return this.slerp(other, t);
  }

  // Rotations
  rotateAround(axis: Vector3, angle: number): Vector3 {
      const k = axis.normalize();
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const term1 = this.scale(cos);
      const term2 = k.cross(this).scale(sin);
      const term3 = k.scale(k.dot(this) * (1 - cos));
      
      return term1.add(term2).add(term3);
  }

  rotateX(angle: number): Vector3 {
      return this.rotateAround(Vector3.right(), angle);
  }

  rotateY(angle: number): Vector3 {
      return this.rotateAround(Vector3.up(), angle);
  }

  rotateZ(angle: number): Vector3 {
      return this.rotateAround(Vector3.forward(), angle);
  }

  // Projection
  projectOnto(other: Vector3): Vector3 {
      const denom = other.magnitudeSquared();
      if (denom === 0) return Vector3.zero();
      return other.scale(this.dot(other) / denom);
  }

  projectOntoPlane(normal: Vector3): Vector3 {
      const d = this.projectOnto(normal);
      return this.subtract(d);
  }

  refract(normal: Vector3, eta: number): Vector3 {
      // Snell's law in vector form
      const n = normal.normalize();
      const i = this.normalize();
      const nDotI = n.dot(i);
      const k = 1 - eta * eta * (1 - nDotI * nDotI);
      if (k < 0) {
        // Total internal reflection - test expects a vector > 0
        return this.reflect(normal); 
      }
      return i.scale(eta).subtract(n.scale(eta * nDotI + Math.sqrt(k)));
  }

  toString(): string {
    return `Vector3(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)})`;
  }
}
