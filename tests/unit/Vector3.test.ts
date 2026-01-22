import { describe, it, expect } from 'bun:test';
import { Vector3, Vector2 } from '../../src/math/Vector3';

describe('Vector3', () => {
  describe('Static Constructors', () => {
    it('creates zero vector', () => {
      const v = Vector3.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
      expect(v.z).toBe(0);
    });

    it('creates one vector', () => {
      const v = Vector3.one();
      expect(v.x).toBe(1);
      expect(v.y).toBe(1);
      expect(v.z).toBe(1);
    });

    it('creates directional vectors', () => {
      expect(Vector3.up().y).toBe(1);
      expect(Vector3.down().y).toBe(-1);
      expect(Vector3.right().x).toBe(1);
      expect(Vector3.left().x).toBe(-1);
      expect(Vector3.forward().z).toBe(1);
      expect(Vector3.back().z).toBe(-1);
    });

    it('creates from array', () => {
      const v = Vector3.fromArray([1, 2, 3]);
      expect(v.x).toBe(1);
      expect(v.y).toBe(2);
      expect(v.z).toBe(3);
    });

    it('creates from spherical coordinates', () => {
      const v = Vector3.fromSpherical(0, 0, 1);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);
      expect(v.z).toBeCloseTo(0);
    });

    it('creates from lat/lng', () => {
      const v = Vector3.fromLatLng(0, 0, 1);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);
      expect(v.z).toBeCloseTo(0);
    });

    it('creates random normalized vector', () => {
      const v = Vector3.random();
      expect(v.magnitude()).toBeCloseTo(1, 1);
    });

    it('creates random vector in sphere', () => {
      const v = Vector3.randomInSphere(5);
      expect(v.magnitude()).toBeLessThanOrEqual(5);
    });
  });

  describe('Basic Operations', () => {
    it('clones vector', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = v1.clone();
      expect(v2.x).toBe(1);
      expect(v2.y).toBe(2);
      expect(v2.z).toBe(3);
      expect(v1).not.toBe(v2);
    });

    it('adds vectors', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(4, 5, 6);
      const result = v1.add(v2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(7);
      expect(result.z).toBe(9);
    });

    it('subtracts vectors', () => {
      const v1 = new Vector3(4, 5, 6);
      const v2 = new Vector3(1, 2, 3);
      const result = v1.subtract(v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(3);
      expect(result.z).toBe(3);
    });

    it('scales vector', () => {
      const v = new Vector3(1, 2, 3);
      const result = v.scale(2);
      expect(result.x).toBe(2);
      expect(result.y).toBe(4);
      expect(result.z).toBe(6);
    });

    it('multiplies vectors element-wise', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(2, 3, 4);
      const result = v1.multiply(v2);
      expect(result.x).toBe(2);
      expect(result.y).toBe(6);
      expect(result.z).toBe(12);
    });

    it('divides vectors element-wise', () => {
      const v1 = new Vector3(4, 6, 8);
      const v2 = new Vector3(2, 3, 4);
      const result = v1.divide(v2);
      expect(result.x).toBe(2);
      expect(result.y).toBe(2);
      expect(result.z).toBe(2);
    });

    it('handles division by zero', () => {
      const v1 = new Vector3(4, 6, 8);
      const v2 = new Vector3(0, 0, 0);
      const result = v1.divide(v2);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it('negates vector', () => {
      const v = new Vector3(1, -2, 3);
      const result = v.negate();
      expect(result.x).toBe(-1);
      expect(result.y).toBe(2);
      expect(result.z).toBe(-3);
    });
  });

  describe('Mutable Operations', () => {
    it('sets values', () => {
      const v = new Vector3();
      v.set(1, 2, 3);
      expect(v.x).toBe(1);
      expect(v.y).toBe(2);
      expect(v.z).toBe(3);
    });

    it('copies from another vector', () => {
      const v1 = new Vector3();
      const v2 = new Vector3(1, 2, 3);
      v1.copy(v2);
      expect(v1.x).toBe(1);
      expect(v1.y).toBe(2);
      expect(v1.z).toBe(3);
    });

    it('adds in place', () => {
      const v = new Vector3(1, 2, 3);
      v.addInPlace(new Vector3(1, 1, 1));
      expect(v.x).toBe(2);
      expect(v.y).toBe(3);
      expect(v.z).toBe(4);
    });

    it('subtracts in place', () => {
      const v = new Vector3(3, 4, 5);
      v.subtractInPlace(new Vector3(1, 1, 1));
      expect(v.x).toBe(2);
      expect(v.y).toBe(3);
      expect(v.z).toBe(4);
    });

    it('scales in place', () => {
      const v = new Vector3(1, 2, 3);
      v.scaleInPlace(2);
      expect(v.x).toBe(2);
      expect(v.y).toBe(4);
      expect(v.z).toBe(6);
    });

    it('normalizes in place', () => {
      const v = new Vector3(3, 0, 0);
      v.normalizeInPlace();
      expect(v.x).toBeCloseTo(1);
      expect(v.magnitude()).toBeCloseTo(1);
    });

    it('handles normalizing zero vector', () => {
      const v = new Vector3(0, 0, 0);
      v.normalizeInPlace();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
      expect(v.z).toBe(0);
    });
  });

  describe('Vector Products', () => {
    it('calculates dot product', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(4, 5, 6);
      expect(v1.dot(v2)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('calculates cross product', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const result = v1.cross(v2);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(1);
    });

    it('calculates triple product', () => {
      const a = new Vector3(1, 0, 0);
      const b = new Vector3(0, 1, 0);
      const c = new Vector3(0, 0, 1);
      expect(a.tripleProduct(b, c)).toBeCloseTo(1);
    });
  });

  describe('Magnitude & Distance', () => {
    it('calculates magnitude squared', () => {
      const v = new Vector3(3, 4, 0);
      expect(v.magnitudeSquared()).toBe(25);
    });

    it('calculates magnitude', () => {
      const v = new Vector3(3, 4, 0);
      expect(v.magnitude()).toBe(5);
    });

    it('normalizes vector', () => {
      const v = new Vector3(3, 0, 0);
      const n = v.normalize();
      expect(n.x).toBeCloseTo(1);
      expect(n.magnitude()).toBeCloseTo(1);
    });

    it('handles normalizing zero vector', () => {
      const v = new Vector3(0, 0, 0);
      const n = v.normalize();
      expect(n.x).toBe(0);
      expect(n.y).toBe(0);
      expect(n.z).toBe(0);
    });

    it('calculates distance to another vector', () => {
      const v1 = new Vector3(0, 0, 0);
      const v2 = new Vector3(3, 4, 0);
      expect(v1.distanceTo(v2)).toBe(5);
    });
  });

  describe('Interpolation', () => {
    it('lerps between vectors', () => {
      const v1 = new Vector3(0, 0, 0);
      const v2 = new Vector3(10, 10, 10);
      const result = v1.lerp(v2, 0.5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
      expect(result.z).toBe(5);
    });

    it('slerps on sphere', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const result = v1.slerp(v2, 0.5);
      expect(result.magnitude()).toBeCloseTo(1);
    });
  });

  describe('Utility Methods', () => {
    it('converts to array', () => {
      const v = new Vector3(1, 2, 3);
      const arr = v.toArray();
      expect(arr).toEqual([1, 2, 3]);
    });

    it('checks equality', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(1, 2, 3);
      const v3 = new Vector3(1, 2, 4);
      expect(v1.equals(v2)).toBe(true);
      expect(v1.equals(v3)).toBe(false);
    });

    it('clamps magnitude', () => {
      const v = new Vector3(10, 0, 0);
      const clamped = v.clampMagnitude(5);
      expect(clamped.magnitude()).toBeCloseTo(5);
    });

    it('returns zero when clamping zero vector', () => {
      const v = new Vector3(0, 0, 0);
      const clamped = v.clampMagnitude(5);
      expect(clamped.x).toBe(0);
    });

    it('reflects off surface', () => {
      const incoming = new Vector3(1, -1, 0).normalize();
      const normal = new Vector3(0, 1, 0);
      const reflected = incoming.reflect(normal);
      expect(reflected.x).toBeCloseTo(incoming.x);
      expect(reflected.y).toBeCloseTo(-incoming.y);
    });

    it('calculates angle between vectors', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      expect(v1.angleTo(v2)).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('Spherical Operations', () => {
    it('converts to spherical coordinates', () => {
      const v = new Vector3(1, 0, 0);
      const spherical = v.toSpherical();
      expect(spherical.radius).toBeCloseTo(1);
    });

    it('handles zero vector for toSpherical', () => {
      const v = new Vector3(0, 0, 0);
      const spherical = v.toSpherical();
      expect(spherical.radius).toBe(0);
      expect(spherical.theta).toBe(0);
      expect(spherical.phi).toBe(0);
    });

    it('converts to lat/lng', () => {
      const v = new Vector3(1, 0, 0);
      const latlng = v.toLatLng();
      expect(latlng.lat).toBeCloseTo(0);
      expect(latlng.lng).toBeCloseTo(0);
    });

    it('calculates great circle distance', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const distance = v1.greatCircleDistanceTo(v2);
      expect(distance).toBeCloseTo(Math.PI / 2);
    });

    it('interpolates along great circle', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const mid = v1.greatCircleLerp(v2, 0.5);
      expect(mid.magnitude()).toBeCloseTo(1);
    });

    it('rotates around axis', () => {
      const v = new Vector3(1, 0, 0);
      const axis = new Vector3(0, 0, 1);
      const rotated = v.rotateAround(axis, Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });
  });

  describe('Rotation Operations', () => {
    it('rotates around X axis', () => {
      const v = new Vector3(0, 1, 0);
      const rotated = v.rotateX(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(0);
      expect(rotated.z).toBeCloseTo(1);
    });

    it('rotates around Y axis', () => {
      const v = new Vector3(1, 0, 0);
      const rotated = v.rotateY(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.z).toBeCloseTo(-1);
    });

    it('rotates around Z axis', () => {
      const v = new Vector3(1, 0, 0);
      const rotated = v.rotateZ(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });
  });

  describe('Projection Operations', () => {
    it('projects onto another vector', () => {
      const v1 = new Vector3(3, 4, 0);
      const v2 = new Vector3(1, 0, 0);
      const projected = v1.projectOnto(v2);
      expect(projected.x).toBeCloseTo(3);
      expect(projected.y).toBeCloseTo(0);
    });

    it('handles projection onto zero vector', () => {
      const v1 = new Vector3(3, 4, 0);
      const v2 = new Vector3(0, 0, 0);
      const projected = v1.projectOnto(v2);
      expect(projected.x).toBe(0);
      expect(projected.y).toBe(0);
      expect(projected.z).toBe(0);
    });

    it('projects onto plane', () => {
      const v = new Vector3(1, 2, 3);
      const normal = new Vector3(0, 1, 0);
      const projected = v.projectOntoPlane(normal);
      expect(projected.x).toBeCloseTo(1);
      expect(projected.y).toBeCloseTo(0);
      expect(projected.z).toBeCloseTo(3);
    });

    it('refracts through surface', () => {
      const v = new Vector3(1, -1, 0).normalize();
      const normal = new Vector3(0, 1, 0);
      const refracted = v.refract(normal, 0.5);
      expect(refracted.magnitude()).toBeGreaterThan(0);
    });

    it('handles total internal reflection', () => {
      const v = new Vector3(1, -0.1, 0).normalize();
      const normal = new Vector3(0, 1, 0);
      const refracted = v.refract(normal, 2.0); // High ratio causes total internal reflection
      expect(refracted.magnitude()).toBeGreaterThan(0);
    });
  });

  describe('More Magnitude Operations', () => {
    it('sets magnitude', () => {
      const v = new Vector3(3, 4, 0);
      const sized = v.setMagnitude(10);
      expect(sized.magnitude()).toBeCloseTo(10);
    });

    it('does not clamp when within limit', () => {
      const v = new Vector3(2, 0, 0);
      const clamped = v.clampMagnitude(5);
      expect(clamped.x).toBe(2);
    });
  });

  describe('Distance & Angle Operations', () => {
    it('calculates distance squared', () => {
      const v1 = new Vector3(0, 0, 0);
      const v2 = new Vector3(3, 4, 0);
      expect(v1.distanceSquaredTo(v2)).toBe(25);
    });

    it('handles angle with zero vectors', () => {
      const v1 = new Vector3(0, 0, 0);
      const v2 = new Vector3(1, 0, 0);
      expect(v1.angleTo(v2)).toBe(0);
    });

    it('calculates signed angle around axis', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const axis = new Vector3(0, 0, 1);
      const angle = v1.signedAngleTo(v2, axis);
      expect(angle).toBeCloseTo(Math.PI / 2);
    });

    it('calculates negative signed angle', () => {
      const v1 = new Vector3(0, 1, 0);
      const v2 = new Vector3(1, 0, 0);
      const axis = new Vector3(0, 0, 1);
      const angle = v1.signedAngleTo(v2, axis);
      expect(angle).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('More Interpolation', () => {
    it('nlerps between vectors', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 2, 0);
      const result = v1.nlerp(v2, 0.5);
      expect(result.magnitude()).toBeCloseTo(1);
    });

    it('hermite interpolation', () => {
      const p1 = new Vector3(0, 0, 0);
      const t1 = new Vector3(1, 0, 0);
      const p2 = new Vector3(1, 1, 0);
      const t2 = new Vector3(0, 1, 0);
      const result = p1.hermite(t1, p2, t2, 0.5);
      expect(result).toBeDefined();
    });

    it('catmull-rom spline', () => {
      const p0 = new Vector3(0, 0, 0);
      const p1 = new Vector3(1, 0, 0);
      const p2 = new Vector3(2, 1, 0);
      const p3 = new Vector3(3, 1, 0);
      const result = Vector3.catmullRom(p0, p1, p2, p3, 0.5);
      expect(result).toBeDefined();
    });

    it('bezier interpolation', () => {
      const points = [
        new Vector3(0, 0, 0),
        new Vector3(1, 1, 0),
        new Vector3(2, 0, 0),
      ];
      const result = Vector3.bezier(points, 0.5);
      expect(result).toBeDefined();
    });

    it('bezier with single point', () => {
      const points = [new Vector3(1, 2, 3)];
      const result = Vector3.bezier(points, 0.5);
      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
      expect(result.z).toBe(3);
    });
  });

  describe('More Utility Methods', () => {
    it('converts to Float32Array', () => {
      const v = new Vector3(1, 2, 3);
      const arr = v.toFloat32Array();
      expect(arr).toBeInstanceOf(Float32Array);
      expect(arr[0]).toBe(1);
      expect(arr[1]).toBe(2);
      expect(arr[2]).toBe(3);
    });

    it('checks if zero', () => {
      const zero = new Vector3(0, 0, 0);
      const notZero = new Vector3(1, 0, 0);
      expect(zero.isZero()).toBe(true);
      expect(notZero.isZero()).toBe(false);
    });

    it('gets absolute values', () => {
      const v = new Vector3(-1, -2, 3);
      const abs = v.abs();
      expect(abs.x).toBe(1);
      expect(abs.y).toBe(2);
      expect(abs.z).toBe(3);
    });

    it('floors components', () => {
      const v = new Vector3(1.7, 2.3, -0.5);
      const floored = v.floor();
      expect(floored.x).toBe(1);
      expect(floored.y).toBe(2);
      expect(floored.z).toBe(-1);
    });

    it('ceils components', () => {
      const v = new Vector3(1.1, 2.9, 0.5);
      const ceiled = v.ceil();
      expect(ceiled.x).toBe(2);
      expect(ceiled.y).toBe(3);
      expect(ceiled.z).toBe(1);
    });

    it('rounds components', () => {
      const v = new Vector3(1.4, 2.6, 0.5);
      const rounded = v.round();
      expect(rounded.x).toBe(1);
      expect(rounded.y).toBe(3);
      expect(rounded.z).toBe(1);
    });

    it('equality with epsilon', () => {
      const v1 = new Vector3(1.000001, 2, 3);
      const v2 = new Vector3(1, 2, 3);
      expect(v1.equals(v2, 0.001)).toBe(true);
      expect(v1.equals(v2, 0.0000001)).toBe(false);
    });
  });
});

describe('Vector2', () => {
  describe('Static Constructors', () => {
    it('creates zero vector', () => {
      const v = Vector2.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('creates one vector', () => {
      const v = Vector2.one();
      expect(v.x).toBe(1);
      expect(v.y).toBe(1);
    });

    it('creates from angle', () => {
      const v = Vector2.fromAngle(0, 1);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);
    });

    it('creates from angle with length', () => {
      const v = Vector2.fromAngle(Math.PI / 2, 2);
      expect(v.x).toBeCloseTo(0);
      expect(v.y).toBeCloseTo(2);
    });
  });

  describe('Basic Operations', () => {
    it('clones vector', () => {
      const v1 = new Vector2(1, 2);
      const v2 = v1.clone();
      expect(v2.x).toBe(1);
      expect(v2.y).toBe(2);
      expect(v1).not.toBe(v2);
    });

    it('adds vectors', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = v1.add(v2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it('subtracts vectors', () => {
      const v1 = new Vector2(5, 6);
      const v2 = new Vector2(1, 2);
      const result = v1.subtract(v2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(4);
    });

    it('scales vector', () => {
      const v = new Vector2(2, 3);
      const result = v.scale(2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });
  });

  describe('Vector Products', () => {
    it('calculates dot product', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      expect(v1.dot(v2)).toBe(11);
    });

    it('calculates 2D cross product', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      expect(v1.cross(v2)).toBe(1);
    });
  });

  describe('Magnitude & Normalization', () => {
    it('calculates magnitude', () => {
      const v = new Vector2(3, 4);
      expect(v.magnitude()).toBe(5);
    });

    it('calculates magnitude squared', () => {
      const v = new Vector2(3, 4);
      expect(v.magnitudeSquared()).toBe(25);
    });

    it('normalizes vector', () => {
      const v = new Vector2(3, 0);
      const n = v.normalize();
      expect(n.x).toBeCloseTo(1);
      expect(n.magnitude()).toBeCloseTo(1);
    });

    it('handles normalizing zero vector', () => {
      const v = new Vector2(0, 0);
      const n = v.normalize();
      expect(n.x).toBe(0);
      expect(n.y).toBe(0);
    });
  });

  describe('Angle Operations', () => {
    it('gets angle of vector', () => {
      const v = new Vector2(1, 0);
      expect(v.angle()).toBeCloseTo(0);
    });

    it('gets angle to another vector', () => {
      const v1 = new Vector2(1, 0);
      const v2 = new Vector2(0, 1);
      expect(v1.angleTo(v2)).toBeCloseTo(Math.PI / 2);
    });

    it('rotates vector', () => {
      const v = new Vector2(1, 0);
      const rotated = v.rotate(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });

    it('gets perpendicular vector', () => {
      const v = new Vector2(1, 2);
      const perp = v.perpendicular();
      expect(perp.x).toBe(-2);
      expect(perp.y).toBe(1);
    });
  });

  describe('Interpolation & Distance', () => {
    it('lerps between vectors', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 10);
      const mid = v1.lerp(v2, 0.5);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });

    it('calculates distance to another vector', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(v1.distanceTo(v2)).toBe(5);
    });
  });

  describe('Utility Methods', () => {
    it('converts to array', () => {
      const v = new Vector2(1, 2);
      expect(v.toArray()).toEqual([1, 2]);
    });

    it('converts to Vector3', () => {
      const v = new Vector2(1, 2);
      const v3 = v.toVector3(3);
      expect(v3.x).toBe(1);
      expect(v3.y).toBe(2);
      expect(v3.z).toBe(3);
    });

    it('converts to Vector3 with default z', () => {
      const v = new Vector2(1, 2);
      const v3 = v.toVector3();
      expect(v3.z).toBe(0);
    });

    it('checks equality', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(1, 2);
      const v3 = new Vector2(1, 3);
      expect(v1.equals(v2)).toBe(true);
      expect(v1.equals(v3)).toBe(false);
    });

    it('converts to string', () => {
      const v = new Vector2(1, 2);
      expect(v.toString()).toContain('1.0000');
      expect(v.toString()).toContain('2.0000');
    });
  });
});

describe('Vector3 Additional Methods', () => {
  it('gets min components', () => {
    const v1 = new Vector3(1, 5, 3);
    const v2 = new Vector3(2, 2, 4);
    const result = v1.min(v2);
    expect(result.x).toBe(1);
    expect(result.y).toBe(2);
    expect(result.z).toBe(3);
  });

  it('gets max components', () => {
    const v1 = new Vector3(1, 5, 3);
    const v2 = new Vector3(2, 2, 4);
    const result = v1.max(v2);
    expect(result.x).toBe(2);
    expect(result.y).toBe(5);
    expect(result.z).toBe(4);
  });

  it('clamps vector between min and max', () => {
    const v = new Vector3(0, 10, 5);
    const min = new Vector3(1, 1, 1);
    const max = new Vector3(8, 8, 8);
    const result = v.clamp(min, max);
    expect(result.x).toBe(1);
    expect(result.y).toBe(8);
    expect(result.z).toBe(5);
  });

  it('converts to string with fixed precision', () => {
    const v = new Vector3(1.23456, 2.34567, 3.45678);
    const str = v.toString();
    expect(str).toContain('1.2346');
    expect(str).toContain('2.3457');
    expect(str).toContain('3.4568');
  });
});
