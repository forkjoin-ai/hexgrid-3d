import { describe, it, expect } from 'bun:test';
import { Quaternion, DualQuaternion } from '../../src/math/Quaternion';
import { Vector3 } from '../../src/math/Vector3';
import { Matrix4 } from '../../src/math/Matrix4';

describe('Quaternion', () => {
  describe('Static Constructors', () => {
    it('creates identity quaternion', () => {
      const q = Quaternion.identity();
      expect(q.w).toBe(1);
      expect(q.x).toBe(0);
      expect(q.y).toBe(0);
      expect(q.z).toBe(0);
    });

    it('creates from axis-angle', () => {
      const axis = new Vector3(0, 1, 0);
      const q = Quaternion.fromAxisAngle(axis, Math.PI / 2);
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('creates from Euler angles', () => {
      const q = Quaternion.fromEuler(0, Math.PI / 2, 0);
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('creates from Euler degrees', () => {
      const q = Quaternion.fromEulerDegrees(0, 90, 0);
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('creates from-to rotation', () => {
      const from = new Vector3(1, 0, 0);
      const to = new Vector3(0, 1, 0);
      const q = Quaternion.fromToRotation(from, to);
      const rotated = q.rotateVector(from);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });

    it('handles parallel vectors in fromToRotation', () => {
      const from = new Vector3(1, 0, 0);
      const to = new Vector3(1, 0, 0);
      const q = Quaternion.fromToRotation(from, to);
      expect(q.isIdentity()).toBe(true);
    });

    it('handles opposite vectors in fromToRotation', () => {
      const from = new Vector3(1, 0, 0);
      const to = new Vector3(-1, 0, 0);
      const q = Quaternion.fromToRotation(from, to);
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('creates from rotation matrix', () => {
      const m = Matrix4.rotationY(Math.PI / 4);
      const q = Quaternion.fromMatrix(m);
      expect(q.magnitude()).toBeGreaterThan(0);
    });

    it('creates random quaternion', () => {
      const q = Quaternion.random();
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('creates look rotation', () => {
      const forward = new Vector3(0, 0, 1);
      const q = Quaternion.lookRotation(forward);
      expect(q.magnitude()).toBeGreaterThan(0);
    });
  });

  describe('Basic Operations', () => {
    it('clones quaternion', () => {
      const q1 = new Quaternion(1, 2, 3, 4);
      const q2 = q1.clone();
      expect(q2.x).toBe(1);
      q2.x = 10;
      expect(q1.x).toBe(1);
    });

    it('sets values', () => {
      const q = new Quaternion();
      q.set(1, 2, 3, 4);
      expect(q.x).toBe(1);
      expect(q.w).toBe(4);
    });

    it('copies quaternion', () => {
      const q1 = new Quaternion(1, 2, 3, 4);
      const q2 = new Quaternion();
      q2.copy(q1);
      expect(q2.x).toBe(1);
    });

    it('multiplies quaternions', () => {
      const q1 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const result = q1.multiply(q2);
      expect(result.magnitude()).toBeCloseTo(1);
    });

    it('premultiplies quaternions', () => {
      const q1 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const q2 = Quaternion.fromAxisAngle(new Vector3(1, 0, 0), Math.PI / 4);
      const result = q1.premultiply(q2);
      expect(result.magnitude()).toBeCloseTo(1);
    });

    it('adds quaternions', () => {
      const q1 = new Quaternion(1, 0, 0, 0);
      const q2 = new Quaternion(0, 1, 0, 0);
      const result = q1.add(q2);
      expect(result.x).toBe(1);
      expect(result.y).toBe(1);
    });

    it('scales quaternion', () => {
      const q = new Quaternion(1, 2, 3, 4);
      const result = q.scale(2);
      expect(result.x).toBe(2);
      expect(result.w).toBe(8);
    });

    it('calculates dot product', () => {
      const q1 = Quaternion.identity();
      const q2 = Quaternion.identity();
      expect(q1.dot(q2)).toBe(1);
    });
  });

  describe('Normalization & Magnitude', () => {
    it('calculates magnitude', () => {
      const q = Quaternion.identity();
      expect(q.magnitude()).toBe(1);
    });

    it('calculates magnitude squared', () => {
      const q = new Quaternion(1, 1, 1, 1);
      expect(q.magnitudeSquared()).toBe(4);
    });

    it('normalizes quaternion', () => {
      const q = new Quaternion(2, 0, 0, 0);
      const n = q.normalize();
      expect(n.magnitude()).toBeCloseTo(1);
    });

    it('handles normalizing zero quaternion', () => {
      const q = new Quaternion(0, 0, 0, 0);
      const n = q.normalize();
      expect(n.isIdentity()).toBe(true);
    });

    it('normalizes in place', () => {
      const q = new Quaternion(2, 0, 0, 0);
      q.normalizeInPlace();
      expect(q.magnitude()).toBeCloseTo(1);
    });
  });

  describe('Inverse & Conjugate', () => {
    it('calculates conjugate', () => {
      const q = new Quaternion(1, 2, 3, 4);
      const c = q.conjugate();
      expect(c.x).toBe(-1);
      expect(c.y).toBe(-2);
      expect(c.z).toBe(-3);
      expect(c.w).toBe(4);
    });

    it('calculates inverse', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const inv = q.inverse();
      const result = q.multiply(inv);
      expect(result.isIdentity()).toBe(true);
    });

    it('handles inverse of zero quaternion', () => {
      const q = new Quaternion(0, 0, 0, 0);
      const inv = q.inverse();
      expect(inv.isIdentity()).toBe(true);
    });
  });

  describe('Interpolation', () => {
    it('slerps between quaternions', () => {
      const q1 = Quaternion.identity();
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const mid = q1.slerp(q2, 0.5);
      expect(mid.magnitude()).toBeCloseTo(1);
    });

    it('handles slerp with negative dot product', () => {
      const q1 = new Quaternion(0, 0, 0, 1);
      const q2 = new Quaternion(0, 0, 0, -1);
      const mid = q1.slerp(q2, 0.5);
      expect(mid.magnitude()).toBeCloseTo(1);
    });

    it('handles slerp with very close quaternions', () => {
      const q1 = Quaternion.identity();
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 0.0001);
      const mid = q1.slerp(q2, 0.5);
      expect(mid.magnitude()).toBeCloseTo(1);
    });

    it('lerps between quaternions', () => {
      const q1 = new Quaternion(0, 0, 0, 1);
      const q2 = new Quaternion(1, 0, 0, 0);
      const mid = q1.lerp(q2, 0.5);
      expect(mid.x).toBe(0.5);
      expect(mid.w).toBe(0.5);
    });

    it('nlerps between quaternions', () => {
      const q1 = Quaternion.identity();
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const mid = q1.nlerp(q2, 0.5);
      expect(mid.magnitude()).toBeCloseTo(1);
    });

    it('squad interpolates through keyframes', () => {
      const a = Quaternion.identity();
      const b = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const c = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const d = Quaternion.fromAxisAngle(
        new Vector3(0, 1, 0),
        (Math.PI * 3) / 4
      );
      const result = Quaternion.squad(a, b, c, d, 0.5);
      expect(result.magnitude()).toBeCloseTo(1);
    });
  });

  describe('Rotation Operations', () => {
    it('rotates vector', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const v = new Vector3(1, 0, 0);
      const result = q.rotateVector(v);
      expect(result.x).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(-1);
    });

    it('gets rotation angle', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      expect(q.getAngle()).toBeCloseTo(Math.PI / 2);
    });

    it('gets rotation axis', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const axis = q.getAxis();
      expect(axis.y).toBeCloseTo(1);
    });

    it('handles zero rotation axis', () => {
      const q = Quaternion.identity();
      const axis = q.getAxis();
      expect(axis.magnitude()).toBeCloseTo(1);
    });

    it('converts to axis-angle', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const { axis, angle } = q.toAxisAngle();
      expect(angle).toBeCloseTo(Math.PI / 2);
      expect(axis.y).toBeCloseTo(1);
    });

    it('converts to Euler angles', () => {
      const q = Quaternion.fromEuler(0.1, 0.2, 0.3);
      const euler = q.toEuler();
      expect(typeof euler.x).toBe('number');
      expect(typeof euler.y).toBe('number');
      expect(typeof euler.z).toBe('number');
    });

    it('converts to Euler degrees', () => {
      const q = Quaternion.fromEulerDegrees(10, 20, 30);
      const euler = q.toEulerDegrees();
      expect(typeof euler.x).toBe('number');
      expect(typeof euler.y).toBe('number');
      expect(typeof euler.z).toBe('number');
    });

    it('converts to Matrix4', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const m = q.toMatrix4();
      expect(m.elements[0]).toBeCloseTo(0);
    });

    it('converts to Matrix3', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const m = q.toMatrix3();
      expect(m.elements[0]).toBeCloseTo(0);
    });
  });

  describe('Utility Methods', () => {
    it('calculates angular distance', () => {
      const q1 = Quaternion.identity();
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      expect(q1.angleTo(q2)).toBeCloseTo(Math.PI / 2);
    });

    it('checks equality (same rotation)', () => {
      const q1 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const q2 = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      expect(q1.equals(q2)).toBe(true);
    });

    it('checks identity', () => {
      expect(Quaternion.identity().isIdentity()).toBe(true);
      expect(
        Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 0.1).isIdentity()
      ).toBe(false);
    });

    it('calculates exponential map', () => {
      const v = new Vector3(0, Math.PI / 4, 0);
      const q = Quaternion.exp(v);
      expect(q.magnitude()).toBeCloseTo(1);
    });

    it('handles exp of zero vector', () => {
      const v = Vector3.zero();
      const q = Quaternion.exp(v);
      expect(q.isIdentity()).toBe(true);
    });

    it('calculates logarithm', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4);
      const v = q.log();
      expect(v.magnitude()).toBeCloseTo(Math.PI / 4);
    });

    it('handles log of identity', () => {
      const q = Quaternion.identity();
      const v = q.log();
      expect(v.magnitude()).toBeCloseTo(0);
    });

    it('calculates power', () => {
      const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      const half = q.pow(0.5);
      expect(half.getAngle()).toBeCloseTo(Math.PI / 4);
    });

    it('handles power of identity', () => {
      const q = Quaternion.identity();
      const result = q.pow(2);
      expect(result.isIdentity()).toBe(true);
    });

    it('converts to array', () => {
      const q = new Quaternion(1, 2, 3, 4);
      const arr = q.toArray();
      expect(arr).toEqual([1, 2, 3, 4]);
    });

    it('converts to string', () => {
      const q = Quaternion.identity();
      expect(q.toString()).toContain('Quaternion');
    });
  });
});

describe('DualQuaternion', () => {
  it('creates from rotation and translation', () => {
    const rotation = Quaternion.fromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 4
    );
    const translation = new Vector3(1, 2, 3);
    const dq = DualQuaternion.fromRotationTranslation(rotation, translation);
    expect(dq.real.magnitude()).toBeCloseTo(1);
  });

  it('clones dual quaternion', () => {
    const dq1 = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(1, 2, 3)
    );
    const dq2 = dq1.clone();
    expect(dq2.real.w).toBe(dq1.real.w);
  });

  it('multiplies dual quaternions', () => {
    const dq1 = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(1, 0, 0)
    );
    const dq2 = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(0, 1, 0)
    );
    const result = dq1.multiply(dq2);
    expect(result.real.isIdentity()).toBe(true);
  });

  it('calculates conjugate', () => {
    const dq = DualQuaternion.fromRotationTranslation(
      Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 4),
      new Vector3(1, 2, 3)
    );
    const conj = dq.conjugate();
    expect(conj.real.x).toBe(-dq.real.x);
  });

  it('normalizes dual quaternion', () => {
    const dq = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(1, 2, 3)
    );
    const norm = dq.normalize();
    expect(norm.real.magnitude()).toBeCloseTo(1);
  });

  it('transforms point', () => {
    const dq = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(1, 2, 3)
    );
    const p = new Vector3(0, 0, 0);
    const result = dq.transformPoint(p);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(2);
    expect(result.z).toBeCloseTo(3);
  });

  it('extracts rotation and translation', () => {
    const rotation = Quaternion.fromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 4
    );
    const translation = new Vector3(1, 2, 3);
    const dq = DualQuaternion.fromRotationTranslation(rotation, translation);
    const { rotation: r, translation: t } = dq.toRotationTranslation();
    expect(t.x).toBeCloseTo(1);
    expect(t.y).toBeCloseTo(2);
    expect(t.z).toBeCloseTo(3);
  });

  it('sclerp interpolates dual quaternions', () => {
    const dq1 = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(0, 0, 0)
    );
    const dq2 = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(10, 0, 0)
    );
    const mid = dq1.sclerp(dq2, 0.5);
    const { translation } = mid.toRotationTranslation();
    expect(translation.x).toBeCloseTo(5);
  });

  it('calculates power', () => {
    const dq = DualQuaternion.fromRotationTranslation(
      Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      new Vector3(0, 0, 0)
    );
    const half = dq.pow(0.5);
    expect(half.real.getAngle()).toBeCloseTo(Math.PI / 4);
  });

  it('handles power of pure translation', () => {
    const dq = DualQuaternion.fromRotationTranslation(
      Quaternion.identity(),
      new Vector3(10, 0, 0)
    );
    const half = dq.pow(0.5);
    expect(half.real.isIdentity()).toBe(true);
  });
});
