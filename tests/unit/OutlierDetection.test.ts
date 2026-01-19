import { describe, it, expect } from 'bun:test'
import {
  detectOutliersZScore,
  detectOutliersIQR,
  detectOutliersModifiedZScore
} from '../../src/algorithms/OutlierDetection'

describe('OutlierDetection', () => {
  describe('Z-Score Method', () => {
    it('returns outlier data structure', () => {
      const values = [10, 11, 10, 11, 10, 11, 10, 11, 10, 1000]
      const result = detectOutliersZScore(values)
      expect(result.outlierIndices).toBeInstanceOf(Array)
      expect(result.scores).toBeInstanceOf(Array)
      expect(typeof result.method).toBe('string')
    })

    it('returns empty for uniform data', () => {
      const values = [10, 10, 10, 10, 10]
      const result = detectOutliersZScore(values)
      expect(result.outlierIndices.length).toBe(0)
    })

    it('handles empty array', () => {
      const result = detectOutliersZScore([])
      expect(result.outlierIndices).toEqual([])
    })

    it('handles single value', () => {
      const result = detectOutliersZScore([10])
      expect(result.outlierIndices).toEqual([])
    })

    it('respects custom threshold', () => {
      const values = [10, 12, 11, 13, 20, 11, 12]
      const strictResult = detectOutliersZScore(values, 1.5)
      const lenientResult = detectOutliersZScore(values, 3.0)
      expect(strictResult.outlierIndices.length).toBeGreaterThanOrEqual(lenientResult.outlierIndices.length)
    })

    it('calculates stats correctly', () => {
      const values = [1, 2, 3, 4, 5]
      const result = detectOutliersZScore(values)
      expect(result.stats.mean).toBe(3)
      expect(result.stats.median).toBe(3)
    })

    it('provides scores for all values', () => {
      const values = [10, 20, 30, 100]
      const result = detectOutliersZScore(values)
      expect(result.scores.length).toBe(4)
    })

    it('includes method in result', () => {
      const result = detectOutliersZScore([1, 2, 3])
      expect(result.method).toBe('zscore')
    })
  })

  describe('IQR Method', () => {
    it('detects outliers using IQR', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
      const result = detectOutliersIQR(values)
      expect(result.outlierIndices).toContain(9)
    })

    it('handles empty array', () => {
      const result = detectOutliersIQR([])
      expect(result.outlierIndices).toEqual([])
    })

    it('calculates IQR in stats', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      const result = detectOutliersIQR(values)
      expect(typeof result.stats.iqr).toBe('number')
    })

    it('respects multiplier parameter', () => {
      const values = [1, 2, 3, 4, 5, 15]
      const strictResult = detectOutliersIQR(values, 1.0)
      const lenientResult = detectOutliersIQR(values, 2.0)
      expect(strictResult.outlierIndices.length).toBeGreaterThanOrEqual(lenientResult.outlierIndices.length)
    })
  })

  describe('Modified Z-Score Method', () => {
    it('detects outliers using MAD', () => {
      const values = [10, 12, 11, 13, 100, 11, 12]
      const result = detectOutliersModifiedZScore(values)
      expect(result.outlierIndices).toContain(4)
    })

    it('handles empty array', () => {
      const result = detectOutliersModifiedZScore([])
      expect(result.outlierIndices).toEqual([])
    })

    it('calculates MAD in stats', () => {
      const values = [1, 2, 3, 4, 5, 6, 7]
      const result = detectOutliersModifiedZScore(values)
      expect(typeof result.stats.mad).toBe('number')
    })

    it('is robust to outliers in calculation', () => {
      // Modified Z-score should be more robust than regular Z-score
      const values = [10, 11, 12, 10, 11, 1000]
      const result = detectOutliersModifiedZScore(values)
      expect(result.outlierIndices).toContain(5)
    })
  })
})
