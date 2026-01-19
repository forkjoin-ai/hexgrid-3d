import { describe, it, expect } from 'bun:test'
import { Matrix4, Matrix3 } from '../../src/math/Matrix4'
import { Vector3 } from '../../src/math/Vector3'

describe('Matrix4', () => {
  describe('Static Constructors', () => {
    it('creates identity matrix', () => {
      const m = Matrix4.identity()
      expect(m.elements[0]).toBe(1)
      expect(m.elements[5]).toBe(1)
      expect(m.elements[10]).toBe(1)
      expect(m.elements[15]).toBe(1)
      expect(m.elements[1]).toBe(0)
    })

    it('creates zero matrix', () => {
      const m = Matrix4.zero()
      for (let i = 0; i < 16; i++) {
        expect(m.elements[i]).toBe(0)
      }
    })

    it('creates perspective projection', () => {
      const m = Matrix4.perspective(Math.PI / 4, 16/9, 0.1, 100)
      expect(m.elements[11]).toBe(-1)
      expect(m.elements[15]).toBe(0)
    })

    it('creates orthographic projection', () => {
      const m = Matrix4.orthographic(-1, 1, -1, 1, 0.1, 100)
      expect(m.elements[15]).toBe(1)
    })

    it('creates lookAt matrix', () => {
      const eye = new Vector3(0, 0, 5)
      const target = new Vector3(0, 0, 0)
      const up = new Vector3(0, 1, 0)
      const m = Matrix4.lookAt(eye, target, up)
      expect(m.elements[15]).toBe(1)
    })

    it('creates translation matrix', () => {
      const m = Matrix4.translation(1, 2, 3)
      expect(m.elements[12]).toBe(1)
      expect(m.elements[13]).toBe(2)
      expect(m.elements[14]).toBe(3)
    })

    it('creates translation from vector', () => {
      const m = Matrix4.translationFromVector(new Vector3(1, 2, 3))
      expect(m.elements[12]).toBe(1)
      expect(m.elements[13]).toBe(2)
      expect(m.elements[14]).toBe(3)
    })

    it('creates scale matrix', () => {
      const m = Matrix4.scale(2, 3, 4)
      expect(m.elements[0]).toBe(2)
      expect(m.elements[5]).toBe(3)
      expect(m.elements[10]).toBe(4)
    })

    it('creates uniform scale matrix', () => {
      const m = Matrix4.uniformScale(2)
      expect(m.elements[0]).toBe(2)
      expect(m.elements[5]).toBe(2)
      expect(m.elements[10]).toBe(2)
    })

    it('creates rotation X matrix', () => {
      const m = Matrix4.rotationX(Math.PI / 2)
      expect(m.elements[0]).toBe(1)
      expect(m.elements[5]).toBeCloseTo(0)
      expect(m.elements[6]).toBeCloseTo(1)
    })

    it('creates rotation Y matrix', () => {
      const m = Matrix4.rotationY(Math.PI / 2)
      expect(m.elements[5]).toBe(1)
      expect(m.elements[0]).toBeCloseTo(0)
    })

    it('creates rotation Z matrix', () => {
      const m = Matrix4.rotationZ(Math.PI / 2)
      expect(m.elements[10]).toBe(1)
      expect(m.elements[0]).toBeCloseTo(0)
    })

    it('creates rotation around axis', () => {
      const axis = new Vector3(0, 1, 0)
      const m = Matrix4.rotationAxis(axis, Math.PI / 2)
      expect(m.elements[0]).toBeCloseTo(0)
    })

    it('creates rotation from Euler angles', () => {
      const m = Matrix4.rotationEuler(0, Math.PI / 2, 0)
      expect(m.elements[0]).toBeCloseTo(0)
    })

    it('composes TRS matrix', () => {
      const t = new Vector3(1, 2, 3)
      const r = Matrix4.identity()
      const s = new Vector3(2, 2, 2)
      const m = Matrix4.compose(t, r, s)
      expect(m.elements[12]).toBe(1)
      expect(m.elements[0]).toBe(2)
    })
  })

  describe('Instance Methods', () => {
    it('clones matrix', () => {
      const m1 = Matrix4.translation(1, 2, 3)
      const m2 = m1.clone()
      expect(m2.elements[12]).toBe(1)
      m2.elements[12] = 5
      expect(m1.elements[12]).toBe(1)
    })

    it('copies matrix', () => {
      const m1 = Matrix4.translation(1, 2, 3)
      const m2 = Matrix4.identity()
      m2.copy(m1)
      expect(m2.elements[12]).toBe(1)
    })

    it('multiplies matrices', () => {
      const t = Matrix4.translation(1, 0, 0)
      const s = Matrix4.scale(2, 2, 2)
      const result = t.multiply(s)
      expect(result.elements[12]).toBe(1)
      expect(result.elements[0]).toBe(2)
    })

    it('premultiplies matrices', () => {
      const a = Matrix4.translation(1, 0, 0)
      const b = Matrix4.scale(2, 2, 2)
      const result = a.premultiply(b)
      expect(result.elements[12]).toBe(2)
    })

    it('transforms point', () => {
      const m = Matrix4.translation(1, 2, 3)
      const p = new Vector3(0, 0, 0)
      const result = m.transformPoint(p)
      expect(result.x).toBe(1)
      expect(result.y).toBe(2)
      expect(result.z).toBe(3)
    })

    it('transforms direction', () => {
      const m = Matrix4.translation(1, 2, 3)
      const d = new Vector3(1, 0, 0)
      const result = m.transformDirection(d)
      expect(result.x).toBe(1)
      expect(result.y).toBe(0)
    })

    it('transforms normal', () => {
      const m = Matrix4.scale(2, 2, 2)
      const n = new Vector3(1, 0, 0)
      const result = m.transformNormal(n)
      expect(result.magnitude()).toBeCloseTo(1)
    })

    it('transforms array of points', () => {
      const m = Matrix4.translation(1, 0, 0)
      const points = [new Vector3(0, 0, 0), new Vector3(1, 1, 1)]
      const result = m.transformPoints(points)
      expect(result[0].x).toBe(1)
      expect(result[1].x).toBe(2)
    })

    it('calculates determinant', () => {
      const m = Matrix4.identity()
      expect(m.determinant()).toBe(1)
    })

    it('calculates determinant of scale matrix', () => {
      const m = Matrix4.scale(2, 3, 4)
      expect(m.determinant()).toBe(24)
    })

    it('calculates inverse', () => {
      const m = Matrix4.translation(1, 2, 3)
      const inv = m.inverse()
      expect(inv).not.toBeNull()
      expect(inv!.elements[12]).toBe(-1)
    })

    it('returns null for singular matrix', () => {
      const m = Matrix4.zero()
      expect(m.inverse()).toBeNull()
    })

    it('calculates transpose', () => {
      const m = new Matrix4([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ])
      const t = m.transpose()
      expect(t.elements[1]).toBe(5)
      expect(t.elements[4]).toBe(2)
    })

    it('extracts translation', () => {
      const m = Matrix4.translation(1, 2, 3)
      const t = m.getTranslation()
      expect(t.x).toBe(1)
      expect(t.y).toBe(2)
      expect(t.z).toBe(3)
    })

    it('extracts scale', () => {
      const m = Matrix4.scale(2, 3, 4)
      const s = m.getScale()
      expect(s.x).toBeCloseTo(2)
      expect(s.y).toBeCloseTo(3)
      expect(s.z).toBeCloseTo(4)
    })

    it('extracts rotation matrix', () => {
      const m = Matrix4.scale(2, 2, 2).multiply(Matrix4.rotationX(Math.PI / 4))
      const rot = m.getRotationMatrix()
      expect(rot.elements[12]).toBe(0)
    })

    it('decomposes matrix', () => {
      const m = Matrix4.translation(1, 2, 3).multiply(Matrix4.scale(2, 2, 2))
      const { translation, scale } = m.decompose()
      expect(translation.x).toBe(1)
      expect(scale.x).toBeCloseTo(2)
    })

    it('lerps between matrices', () => {
      const m1 = Matrix4.translation(0, 0, 0)
      const m2 = Matrix4.translation(10, 0, 0)
      const mid = m1.lerp(m2, 0.5)
      expect(mid.elements[12]).toBe(5)
    })

    it('checks equality', () => {
      const m1 = Matrix4.identity()
      const m2 = Matrix4.identity()
      expect(m1.equals(m2)).toBe(true)
    })

    it('converts to array', () => {
      const m = Matrix4.identity()
      const arr = m.toArray()
      expect(arr.length).toBe(16)
      expect(arr[0]).toBe(1)
    })

    it('converts to string', () => {
      const m = Matrix4.identity()
      const str = m.toString()
      expect(str).toContain('Matrix4')
      expect(str).toContain('1.0000')
    })
  })

  describe('Edge Cases', () => {
    it('handles lookAt with parallel vectors', () => {
      const eye = new Vector3(0, 0, 0)
      const target = new Vector3(0, 0, 1)
      const up = new Vector3(0, 0, 1)
      const m = Matrix4.lookAt(eye, target, up)
      expect(m.elements[15]).toBe(1)
    })

    it('handles lookAt with same eye and target', () => {
      const eye = new Vector3(0, 0, 0)
      const target = new Vector3(0, 0, 0)
      const up = new Vector3(0, 1, 0)
      const m = Matrix4.lookAt(eye, target, up)
      expect(m.elements[15]).toBe(1)
    })
  })
})

describe('Matrix3', () => {
  it('creates identity matrix', () => {
    const m = Matrix3.identity()
    expect(m.elements[0]).toBe(1)
    expect(m.elements[4]).toBe(1)
    expect(m.elements[8]).toBe(1)
  })

  it('creates from Matrix4', () => {
    const m4 = Matrix4.scale(2, 3, 4)
    const m3 = Matrix3.fromMatrix4(m4)
    expect(m3.elements[0]).toBe(2)
    expect(m3.elements[4]).toBe(3)
    expect(m3.elements[8]).toBe(4)
  })

  it('clones matrix', () => {
    const m1 = Matrix3.identity()
    m1.elements[0] = 5
    const m2 = m1.clone()
    expect(m2.elements[0]).toBe(5)
  })

  it('multiplies matrices', () => {
    const m1 = Matrix3.identity()
    m1.elements[0] = 2
    const m2 = Matrix3.identity()
    const result = m1.multiply(m2)
    expect(result.elements[0]).toBe(2)
  })

  it('transforms vector', () => {
    const m = Matrix3.identity()
    m.elements[0] = 2
    const v = new Vector3(1, 1, 1)
    const result = m.transformVector(v)
    expect(result.x).toBe(2)
  })

  it('calculates determinant', () => {
    const m = Matrix3.identity()
    expect(m.determinant()).toBe(1)
  })

  it('calculates inverse', () => {
    const m = Matrix3.identity()
    m.elements[0] = 2
    const inv = m.inverse()
    expect(inv).not.toBeNull()
    expect(inv!.elements[0]).toBe(0.5)
  })

  it('returns null for singular matrix', () => {
    const m = new Matrix3([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(m.inverse()).toBeNull()
  })

  it('calculates transpose', () => {
    const m = new Matrix3([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const t = m.transpose()
    expect(t.elements[1]).toBe(4)
    expect(t.elements[3]).toBe(2)
  })
})
