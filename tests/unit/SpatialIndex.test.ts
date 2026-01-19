import { describe, it, expect } from 'bun:test'
import { KDTree, SpatialHashGrid } from '../../src/math/SpatialIndex'
import { Vector3, Vector2 } from '../../src/math/Vector3'

describe('KDTree', () => {
  describe('Building', () => {
    it('builds tree from points', () => {
      const points = [[0, 0, 0], [1, 1, 1], [2, 2, 2]]
      const data = ['a', 'b', 'c']
      const tree = KDTree.build(points, data)
      expect(tree).toBeDefined()
    })

    it('builds from Vector3 array', () => {
      const vectors = [new Vector3(0, 0, 0), new Vector3(1, 1, 1)]
      const data = ['a', 'b']
      const tree = KDTree.fromVector3(vectors, data)
      expect(tree).toBeDefined()
    })

    it('builds from Vector2 array', () => {
      const vectors = [new Vector2(0, 0), new Vector2(1, 1)]
      const data = ['a', 'b']
      const tree = KDTree.fromVector2(vectors, data)
      expect(tree).toBeDefined()
    })

    it('handles empty arrays', () => {
      const tree = KDTree.build([], [])
      expect(tree).toBeDefined()
    })

    it('throws on mismatched lengths', () => {
      expect(() => KDTree.build([[0, 0]], ['a', 'b'])).toThrow()
    })
  })

  describe('Insertion', () => {
    it('inserts points', () => {
      const tree = new KDTree<string>(3)
      tree.insert([0, 0, 0], 'origin')
      tree.insert([1, 1, 1], 'one')
      const result = tree.nearestNeighbor([0, 0, 0])
      expect(result?.data).toBe('origin')
    })
  })

  describe('Nearest Neighbor', () => {
    it('finds nearest neighbor', () => {
      const points = [[0, 0, 0], [10, 10, 10], [5, 5, 5]]
      const data = ['origin', 'far', 'mid']
      const tree = KDTree.build(points, data)
      const result = tree.nearestNeighbor([4, 4, 4])
      expect(result?.data).toBe('mid')
    })

    it('returns null for empty tree', () => {
      const tree = new KDTree<string>(3)
      expect(tree.nearestNeighbor([0, 0, 0])).toBeNull()
    })

    it('handles query at exact point', () => {
      const points = [[0, 0, 0], [1, 1, 1]]
      const data = ['a', 'b']
      const tree = KDTree.build(points, data)
      const result = tree.nearestNeighbor([0, 0, 0])
      expect(result?.data).toBe('a')
      expect(result?.distance).toBe(0)
    })
  })

  describe('K-Nearest Neighbors', () => {
    it('finds k nearest', () => {
      const points = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [10, 10, 10]]
      const data = ['a', 'b', 'c', 'd']
      const tree = KDTree.build(points, data)
      const result = tree.kNearest([0, 0, 0], 2)
      expect(result.length).toBe(2)
      expect(result[0].data).toBe('a')
    })

    it('returns empty for k=0', () => {
      const tree = KDTree.build([[0, 0, 0]], ['a'])
      expect(tree.kNearest([0, 0, 0], 0)).toEqual([])
    })

    it('returns all when k > n', () => {
      const tree = KDTree.build([[0, 0, 0], [1, 1, 1]], ['a', 'b'])
      const result = tree.kNearest([0, 0, 0], 10)
      expect(result.length).toBe(2)
    })
  })

  describe('Range Query', () => {
    it('finds points within radius', () => {
      const points = [[0, 0, 0], [1, 0, 0], [10, 0, 0]]
      const data = ['a', 'b', 'c']
      const tree = KDTree.build(points, data)
      const result = tree.rangeQuery([0, 0, 0], 2)
      expect(result.length).toBe(2)
    })

    it('returns empty for no matches', () => {
      const tree = KDTree.build([[10, 10, 10]], ['a'])
      const result = tree.rangeQuery([0, 0, 0], 1)
      expect(result.length).toBe(0)
    })
  })

  describe('Box Query', () => {
    it('finds points within box', () => {
      const points = [[0, 0, 0], [5, 5, 5], [10, 10, 10]]
      const data = ['a', 'b', 'c']
      const tree = KDTree.build(points, data)
      const result = tree.boxQuery([0, 0, 0], [6, 6, 6])
      expect(result.length).toBe(2)
    })

    it('returns empty for no matches', () => {
      const tree = KDTree.build([[10, 10, 10]], ['a'])
      const result = tree.boxQuery([0, 0, 0], [5, 5, 5])
      expect(result.length).toBe(0)
    })
  })
})

describe('SpatialHashGrid', () => {
  describe('Basic Operations', () => {
    it('creates grid', () => {
      const grid = new SpatialHashGrid<string>(10)
      expect(grid).toBeDefined()
    })

    it('inserts and queries points', () => {
      const grid = new SpatialHashGrid<string>(10)
      grid.insert([5, 5, 5], 'test')
      const result = grid.query([5, 5, 5], 1)
      expect(result.length).toBe(1)
      expect(result[0].data).toBe('test')
    })

    it('bulk inserts', () => {
      const grid = new SpatialHashGrid<string>(10)
      grid.insertAll([
        { position: [0, 0, 0], data: 'a' },
        { position: [1, 1, 1], data: 'b' }
      ])
      const result = grid.query([0, 0, 0], 5)
      expect(result.length).toBe(2)
    })

    it('removes points', () => {
      const grid = new SpatialHashGrid<string>(10)
      grid.insert([5, 5, 5], 'test')
      const removed = grid.remove([5, 5, 5], 'test')
      expect(removed).toBe(true)
      const result = grid.query([5, 5, 5], 1)
      expect(result.length).toBe(0)
    })

    it('returns false when removing non-existent', () => {
      const grid = new SpatialHashGrid<string>(10)
      expect(grid.remove([0, 0, 0], 'test')).toBe(false)
    })

    it('clears grid', () => {
      const grid = new SpatialHashGrid<string>(10)
      grid.insert([5, 5, 5], 'test')
      grid.clear()
      const result = grid.query([5, 5, 5], 100)
      expect(result.length).toBe(0)
    })
  })

  describe('Query', () => {
    it('queries with radius', () => {
      const grid = new SpatialHashGrid<string>(5)
      grid.insert([0, 0, 0], 'origin')
      grid.insert([3, 0, 0], 'near')
      grid.insert([100, 0, 0], 'far')
      const result = grid.query([0, 0, 0], 5)
      expect(result.length).toBe(2)
    })

    it('respects radius limit', () => {
      const grid = new SpatialHashGrid<string>(5)
      grid.insert([0, 0, 0], 'origin')
      grid.insert([10, 0, 0], 'far')
      const result = grid.query([0, 0, 0], 5)
      expect(result.length).toBe(1)
    })
  })

  describe('Nearest Neighbor', () => {
    it('finds nearest', () => {
      const grid = new SpatialHashGrid<string>(5)
      grid.insert([0, 0, 0], 'origin')
      grid.insert([10, 0, 0], 'far')
      grid.insert([3, 0, 0], 'near')
      const result = grid.nearest([1, 0, 0], 10)
      expect(result?.data).toBe('origin')
    })

    it('returns null for empty grid', () => {
      const grid = new SpatialHashGrid<string>(5)
      expect(grid.nearest([0, 0, 0], 10)).toBeNull()
    })
  })

  describe('2D Grid', () => {
    it('works with 2D coordinates', () => {
      const grid = new SpatialHashGrid<string>(10, 2)
      grid.insert([5, 5], 'test')
      const result = grid.query([5, 5], 1)
      expect(result.length).toBe(1)
    })
  })
})
