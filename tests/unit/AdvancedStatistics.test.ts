import { describe, it, expect } from 'bun:test'
import {
  giniCoefficient,
  theilIndex,
  atkinsonIndex,
  paretoRatio
} from '../../src/algorithms/AdvancedStatistics'

describe('AdvancedStatistics', () => {
  describe('Gini Coefficient', () => {
    it('returns 0 for perfect equality', () => {
      const values = [100, 100, 100, 100]
      expect(giniCoefficient(values)).toBeCloseTo(0)
    })

    it('returns close to 1 for high inequality', () => {
      const values = [0, 0, 0, 1000]
      expect(giniCoefficient(values)).toBeGreaterThan(0.7)
    })

    it('handles empty array', () => {
      expect(giniCoefficient([])).toBe(0)
    })

    it('handles single value', () => {
      expect(giniCoefficient([100])).toBe(0)
    })

    it('handles all zeros', () => {
      expect(giniCoefficient([0, 0, 0])).toBe(0)
    })

    it('calculates moderate inequality', () => {
      const values = [10, 20, 30, 40]
      const gini = giniCoefficient(values)
      expect(gini).toBeGreaterThan(0)
      expect(gini).toBeLessThan(0.5)
    })
  })

  describe('Theil Index', () => {
    it('returns 0 for perfect equality', () => {
      const values = [100, 100, 100, 100]
      expect(theilIndex(values)).toBeCloseTo(0)
    })

    it('returns positive for inequality', () => {
      const values = [10, 20, 30, 100]
      expect(theilIndex(values)).toBeGreaterThan(0)
    })

    it('handles empty array', () => {
      expect(theilIndex([])).toBe(0)
    })

    it('handles all zeros', () => {
      expect(theilIndex([0, 0, 0])).toBe(0)
    })

    it('handles zeros in data', () => {
      const values = [0, 10, 20, 30]
      expect(typeof theilIndex(values)).toBe('number')
    })
  })

  describe('Atkinson Index', () => {
    it('returns 0 for perfect equality', () => {
      const values = [100, 100, 100, 100]
      expect(atkinsonIndex(values)).toBeCloseTo(0, 1)
    })

    it('returns positive for inequality', () => {
      const values = [10, 20, 30, 100]
      expect(atkinsonIndex(values)).toBeGreaterThan(0)
    })

    it('handles empty array', () => {
      expect(atkinsonIndex([])).toBe(0)
    })

    it('handles all zeros', () => {
      expect(atkinsonIndex([0, 0, 0])).toBe(0)
    })

    it('respects epsilon parameter', () => {
      const values = [10, 20, 30, 100]
      const lowEpsilon = atkinsonIndex(values, 0.5)
      const highEpsilon = atkinsonIndex(values, 2)
      expect(highEpsilon).toBeGreaterThan(lowEpsilon)
    })

    it('handles epsilon = 1', () => {
      const values = [10, 20, 30, 100]
      const result = atkinsonIndex(values, 1)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(1)
    })
  })

  describe('Pareto Ratio', () => {
    it('calculates top percentile share', () => {
      const values = [10, 10, 10, 10, 60]
      const result = paretoRatio(values, 0.2)
      expect(result.ratioHeld).toBeCloseTo(0.6)
    })

    it('handles empty array', () => {
      const result = paretoRatio([])
      expect(result.ratioHeld).toBe(0)
      expect(result.paretoIndex).toBe(0)
    })

    it('handles all zeros', () => {
      const result = paretoRatio([0, 0, 0])
      expect(result.ratioHeld).toBe(0)
    })

    it('calculates Pareto index', () => {
      const values = [1, 2, 3, 4, 100]
      const result = paretoRatio(values)
      expect(typeof result.paretoIndex).toBe('number')
    })
  })
})
