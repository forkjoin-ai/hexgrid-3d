import { describe, it, expect } from 'bun:test'
import { kMeansClustering } from '../../src/algorithms/GraphAlgorithms'

describe('GraphAlgorithms', () => {
  describe('K-Means Clustering', () => {
    it('clusters points into k groups', () => {
      const points = [
        [0, 0], [1, 0], [0, 1],  // cluster 1
        [10, 10], [11, 10], [10, 11],  // cluster 2
        [20, 0], [21, 0], [20, 1]  // cluster 3
      ]
      const clusters = kMeansClustering(points, 3)
      expect(clusters.length).toBe(3)
    })

    it('returns empty for empty input', () => {
      expect(kMeansClustering([], 3)).toEqual([])
    })

    it('returns empty for k=0', () => {
      expect(kMeansClustering([[0, 0]], 0)).toEqual([])
    })

    it('handles k > n', () => {
      const points = [[0, 0], [1, 1]]
      const clusters = kMeansClustering(points, 10)
      expect(clusters.length).toBe(2)
    })

    it('clusters have centroids', () => {
      const points = [[0, 0], [10, 10]]
      const clusters = kMeansClustering(points, 2)
      clusters.forEach(c => {
        expect(c.centroid).toBeDefined()
        expect(c.centroid.length).toBe(2)
      })
    })

    it('clusters have members', () => {
      const points = [[0, 0], [1, 1], [10, 10], [11, 11]]
      const clusters = kMeansClustering(points, 2)
      const totalMembers = clusters.reduce((sum, c) => sum + c.members.length, 0)
      expect(totalMembers).toBe(4)
    })

    it('calculates cohesion', () => {
      const points = [[0, 0], [1, 1], [10, 10], [11, 11]]
      const clusters = kMeansClustering(points, 2)
      clusters.forEach(c => {
        expect(typeof c.cohesion).toBe('number')
      })
    })

    it('respects maxIterations', () => {
      const points = Array.from({ length: 100 }, (_, i) => [i % 10, Math.floor(i / 10)])
      const clusters = kMeansClustering(points, 5, 10)
      expect(clusters.length).toBe(5)
    })

    it('respects tolerance', () => {
      const points = [[0, 0], [1, 1], [10, 10], [11, 11]]
      const clusters = kMeansClustering(points, 2, 100, 0.1)
      expect(clusters.length).toBe(2)
    })

    it('handles 3D points', () => {
      const points = [
        [0, 0, 0], [1, 1, 1],
        [10, 10, 10], [11, 11, 11]
      ]
      const clusters = kMeansClustering(points, 2)
      expect(clusters.length).toBe(2)
    })

    it('handles single cluster', () => {
      const points = [[0, 0], [1, 0], [0, 1], [1, 1]]
      const clusters = kMeansClustering(points, 1)
      expect(clusters.length).toBe(1)
      expect(clusters[0].members.length).toBe(4)
    })
  })
})
