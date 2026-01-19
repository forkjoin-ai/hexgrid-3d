/**
 * Tests for pure hexgrid mathematical functions.
 * These tests verify deterministic, side-effect-free calculations.
 */

import {
  getGridBounds,
  distanceBetween,
  calculateUvBoundsFromGridPosition,
  calculateContiguity,
  calculatePhotoContiguity,
  calculateSwappedContiguity,
} from '../../src/workers/hexgrid-math'

describe('Hexgrid Math - Pure Functions', () => {
  describe('getGridBounds', () => {
    it('calculates correct bounds for multiple positions', () => {
      const positions: [number, number, number][] = [
        [0, 0, 0],
        [10, 20, 0],
        [5, 10, 0],
      ]
      const bounds = getGridBounds(positions)
      
      expect(bounds).toEqual({
        minX: 0,
        maxX: 10,
        minY: 0,
        maxY: 20,
        width: 10,
        height: 20,
      })
    })

    it('handles single position', () => {
      const positions: [number, number, number][] = [[5, 7, 0]]
      const bounds = getGridBounds(positions)
      
      expect(bounds).toEqual({
        minX: 5,
        maxX: 5,
        minY: 7,
        maxY: 7,
        width: 0,
        height: 0,
      })
    })

    it('handles negative coordinates', () => {
      const positions: [number, number, number][] = [
        [-10, -5, 0],
        [10, 15, 0],
        [0, 0, 0],
      ]
      const bounds = getGridBounds(positions)
      
      expect(bounds).toEqual({
        minX: -10,
        maxX: 10,
        minY: -5,
        maxY: 15,
        width: 20,
        height: 20,
      })
    })

    it('handles empty array', () => {
      const bounds = getGridBounds([])
      
      expect(bounds).toEqual({
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
      })
    })

    it('ignores null/undefined positions in array', () => {
      const positions = [
        [0, 0, 0],
        null as any,
        [10, 10, 0],
        undefined as any,
      ] as [number, number, number][]
      
      const bounds = getGridBounds(positions)
      
      expect(bounds).toEqual({
        minX: 0,
        maxX: 10,
        minY: 0,
        maxY: 10,
        width: 10,
        height: 10,
      })
    })

    it('handles all positions at origin', () => {
      const positions: [number, number, number][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]
      const bounds = getGridBounds(positions)
      
      expect(bounds.width).toBe(0)
      expect(bounds.height).toBe(0)
    })

    it('uses Z coordinate correctly (only X/Y for bounds)', () => {
      const positions: [number, number, number][] = [
        [0, 0, 100],
        [10, 10, -50],
      ]
      const bounds = getGridBounds(positions)
      
      // Z should not affect bounds
      expect(bounds.width).toBe(10)
      expect(bounds.height).toBe(10)
    })
  })

  describe('distanceBetween', () => {
    const bounds = { width: 100, height: 100 }

    describe('Euclidean distance (non-spherical)', () => {
      it('calculates distance correctly for horizontal line', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [5, 0, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(5)
      })

      it('calculates distance correctly for vertical line', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [0, 12, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(12)
      })

      it('calculates 3-4-5 right triangle correctly', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [3, 4, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(5)
      })

      it('handles diagonal distance', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [1, 1, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBeCloseTo(Math.sqrt(2), 10)
      })

      it('calculates distance between same point as zero', () => {
        const a: [number, number, number] = [5, 7, 0]
        const b: [number, number, number] = [5, 7, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(0)
      })

      it('handles negative coordinates', () => {
        const a: [number, number, number] = [-3, -4, 0]
        const b: [number, number, number] = [0, 0, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(5)
      })
    })

    describe('Spherical distance (toroidal wrapping)', () => {
      it('wraps around horizontally when closer', () => {
        const a: [number, number, number] = [5, 50, 0]
        const b: [number, number, number] = [95, 50, 0]
        const bounds = { width: 100, height: 100 }
        
        // Direct distance: 90
        // Wrapped distance: 5 + (100 - 95) = 10
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(10) // Wraps around
      })

      it('wraps around vertically when closer', () => {
        const a: [number, number, number] = [50, 5, 0]
        const b: [number, number, number] = [50, 95, 0]
        const bounds = { width: 100, height: 100 }
        
        // Direct distance: 90
        // Wrapped distance: 10
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(10)
      })

      it('uses direct path when wrapping is not shorter', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [30, 0, 0]
        const bounds = { width: 100, height: 100 }
        
        // Direct: 30, Wrapped: 70 - direct is shorter
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(30)
      })

      it('handles wrapping at exactly halfway point', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [50, 0, 0]
        const bounds = { width: 100, height: 100 }
        
        // At exactly width/2, no wrapping should occur (direct = wrapped)
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(50)
      })

      it('handles diagonal wrapping', () => {
        const a: [number, number, number] = [5, 5, 0]
        const b: [number, number, number] = [95, 95, 0]
        const bounds = { width: 100, height: 100 }
        
        // Both X and Y should wrap
        // Wrapped: dx=10, dy=10 -> sqrt(200) ≈ 14.14
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBeCloseTo(Math.sqrt(200), 5)
      })

      it('handles zero width bounds gracefully', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [10, 0, 0]
        const bounds = { width: 0, height: 100 }
        
        // Should not wrap with zero width
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(10)
      })

      it('handles zero height bounds gracefully', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [0, 10, 0]
        const bounds = { width: 100, height: 0 }
        
        // Should not wrap with zero height
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(10)
      })

      it('wraps negative coordinates correctly', () => {
        const a: [number, number, number] = [-5, 0, 0]
        const b: [number, number, number] = [5, 0, 0]
        const bounds = { width: 100, height: 100 }
        
        const dist = distanceBetween(a, b, bounds, true)
        expect(dist).toBe(10)
      })
    })

    describe('Edge cases', () => {
      it('ignores Z coordinate', () => {
        const a: [number, number, number] = [0, 0, 100]
        const b: [number, number, number] = [3, 4, -50]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBe(5) // 3-4-5 triangle, Z doesn't matter
      })

      it('handles very large distances', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [1e6, 1e6, 0]
        const bounds = { width: 2e6, height: 2e6 }
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBeCloseTo(Math.sqrt(2e12), 0)
      })

      it('handles very small distances', () => {
        const a: [number, number, number] = [0, 0, 0]
        const b: [number, number, number] = [0.001, 0.001, 0]
        
        const dist = distanceBetween(a, b, bounds, false)
        expect(dist).toBeCloseTo(Math.sqrt(0.000002), 10)
      })
    })
  })

  describe('calculateUvBoundsFromGridPosition', () => {
    it('calculates UV bounds for top-left tile', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(0, 0, 4, 4)
      
      expect(minU).toBe(0)
      expect(maxU).toBe(0.25)
      expect(minV).toBe(0.75) // V=1 is top, row 0 -> 0.75-1.0
      expect(maxV).toBe(1.0)
    })

    it('calculates UV bounds for bottom-right tile', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(3, 3, 4, 4)
      
      expect(minU).toBe(0.75)
      expect(maxU).toBe(1.0)
      expect(minV).toBe(0) // Bottom row
      expect(maxV).toBe(0.25)
    })

    it('calculates UV bounds for center tile in 3x3 grid', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(1, 1, 3, 3)
      
      expect(minU).toBeCloseTo(1 / 3, 10)
      expect(maxU).toBeCloseTo(2 / 3, 10)
      expect(minV).toBeCloseTo(1 / 3, 10)
      expect(maxV).toBeCloseTo(2 / 3, 10)
    })

    it('handles single tile (1x1 grid)', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(0, 0, 1, 1)
      
      expect(minU).toBe(0)
      expect(maxU).toBe(1)
      expect(minV).toBe(0)
      expect(maxV).toBe(1)
    })

    it('handles rectangular grids (wide)', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(2, 0, 8, 2)
      
      expect(minU).toBe(0.25)
      expect(maxU).toBe(0.375)
      expect(minV).toBe(0.5)
      expect(maxV).toBe(1.0)
    })

    it('handles rectangular grids (tall)', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(0, 3, 2, 8)
      
      expect(minU).toBe(0)
      expect(maxU).toBe(0.5)
      expect(minV).toBeCloseTo(0.5, 10)
      expect(maxV).toBeCloseTo(0.625, 10)
    })

    it('ensures UV bounds are always in [0, 1] range', () => {
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 5; row++) {
          const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(col, row, 5, 5)
          
          expect(minU).toBeGreaterThanOrEqual(0)
          expect(minU).toBeLessThanOrEqual(1)
          expect(maxU).toBeGreaterThanOrEqual(0)
          expect(maxU).toBeLessThanOrEqual(1)
          expect(minV).toBeGreaterThanOrEqual(0)
          expect(minV).toBeLessThanOrEqual(1)
          expect(maxV).toBeGreaterThanOrEqual(0)
          expect(maxV).toBeLessThanOrEqual(1)
        }
      }
    })

    it('ensures minU < maxU and minV < maxV', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(2, 2, 5, 5)
      
      expect(minU).toBeLessThan(maxU)
      expect(minV).toBeLessThan(maxV)
    })

    it('handles zero tilesX gracefully', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(0, 0, 0, 4)
      
      // Should return full UV range as fallback
      expect(minU).toBe(0)
      expect(maxU).toBe(1)
    })

    it('handles zero tilesY gracefully', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(0, 0, 4, 0)
      
      // Should return full UV range as fallback
      expect(minV).toBe(0)
      expect(maxV).toBe(1)
    })

    it('handles negative grid positions', () => {
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(-1, -1, 4, 4)
      
      // Should still calculate, though negative positions are unusual
      expect(minU).toBe(-0.25)
      expect(maxU).toBe(0)
    })

    it('maintains consistent tile size across grid', () => {
      const tilesX = 5
      const tilesY = 5
      const expectedTileWidth = 1 / tilesX
      const expectedTileHeight = 1 / tilesY
      
      for (let col = 0; col < tilesX; col++) {
        for (let row = 0; row < tilesY; row++) {
          const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(col, row, tilesX, tilesY)
          
          const tileWidth = maxU - minU
          const tileHeight = maxV - minV
          
          expect(tileWidth).toBeCloseTo(expectedTileWidth, 10)
          expect(tileHeight).toBeCloseTo(expectedTileHeight, 10)
        }
      }
    })
  })

  describe('calculateContiguity', () => {
    // Mock neighbor function for testing
    const createNeighborMap = (neighborMap: Map<number, number[]>) => {
      return (index: number) => neighborMap.get(index) || []
    }

    it('calculates zero contiguity for isolated indices', () => {
      const indices = [0, 5, 10] // No connections
      const positions: [number, number, number][] = Array(15)
        .fill(null)
        .map((_, i) => [i * 10, 0, 0])
      
      const neighborMap = new Map([
        [0, [1]],
        [5, [4, 6]],
        [10, [9, 11]],
      ])
      
      const score = calculateContiguity(indices, positions, 1.0, createNeighborMap(neighborMap))
      expect(score).toBe(0) // No indices are neighbors with each other
    })

    it('calculates contiguity for connected line', () => {
      const indices = [0, 1, 2]
      const positions: [number, number, number][] = Array(5)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      const neighborMap = new Map([
        [0, [1]],
        [1, [0, 2]],
        [2, [1, 3]],
      ])
      
      const score = calculateContiguity(indices, positions, 1.0, createNeighborMap(neighborMap))
      // 0->1 (1), 1->0 (1), 1->2 (1), 2->1 (1) = 4 connections
      expect(score).toBe(4)
    })

    it('calculates contiguity for cluster', () => {
      const indices = [0, 1, 3, 4] // 2x2 square
      const positions: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [2, 0, 0],
      ]
      
      const neighborMap = new Map([
        [0, [1, 3]],
        [1, [0, 4, 3]],
        [3, [0, 1, 4]],
        [4, [1, 3]],
      ])
      
      const score = calculateContiguity(indices, positions, 1.0, createNeighborMap(neighborMap))
      // 0: [1,3] in set = 2, 1: [0,4,3] in set = 3, 3: [0,1,4] in set = 3, 4: [1,3] in set = 2
      // Total: 2+3+3+2 = 10
      expect(score).toBe(10)
    })

    it('handles empty indices array', () => {
      const positions: [number, number, number][] = [[0, 0, 0]]
      const score = calculateContiguity([], positions, 1.0, createNeighborMap(new Map()))
      expect(score).toBe(0)
    })

    it('handles single index', () => {
      const indices = [0]
      const positions: [number, number, number][] = [[0, 0, 0]]
      const neighborMap = new Map([[0, []]])
      
      const score = calculateContiguity(indices, positions, 1.0, createNeighborMap(neighborMap))
      expect(score).toBe(0) // Single node has no internal connections
    })

    it('ignores neighbors outside the index set', () => {
      const indices = [1, 2]
      const positions: [number, number, number][] = Array(5)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      const neighborMap = new Map([
        [1, [0, 2, 3]], // 0 and 3 are not in indices
        [2, [1, 3, 4]], // 3 and 4 are not in indices
      ])
      
      const score = calculateContiguity(indices, positions, 1.0, createNeighborMap(neighborMap))
      // Only 1->2 and 2->1 count
      expect(score).toBe(2)
    })

    it('handles invalid hexRadius', () => {
      const indices = [0, 1]
      const positions: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
      ]
      
      const score = calculateContiguity(indices, positions, 0, createNeighborMap(new Map()))
      expect(score).toBe(0)
    })

    it('handles empty positions array', () => {
      const score = calculateContiguity([0, 1], [], 1.0, createNeighborMap(new Map()))
      expect(score).toBe(0)
    })
  })

  describe('calculatePhotoContiguity', () => {
    it('delegates to calculateContiguity correctly', () => {
      const indices = [0, 1, 2]
      const positions: [number, number, number][] = Array(5)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      const neighborMap = new Map([
        [0, [1]],
        [1, [0, 2]],
        [2, [1, 3]],
      ])
      
      const getNeighbors = (index: number) => neighborMap.get(index) || []
      
      const score = calculatePhotoContiguity(indices, positions, 1.0, getNeighbors)
      expect(score).toBe(4) // Same as calculateContiguity
    })
  })

  describe('calculateSwappedContiguity', () => {
    const createNeighborMap = (neighborMap: Map<number, number[]>) => {
      return (index: number) => neighborMap.get(index) || []
    }

    it('calculates contiguity after swapping two indices', () => {
      const indices = [0, 1, 2]
      const positions: [number, number, number][] = Array(6)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      // Swap 0 and 3: [3, 1, 2]
      const neighborMap = new Map([
        [0, [1]],
        [1, [0, 2]],
        [2, [1, 3]],
        [3, [2, 4]],
      ])
      
      const score = calculateSwappedContiguity(
        indices,
        positions,
        1.0,
        0, // swap from index 0
        3, // swap to index 3
        createNeighborMap(neighborMap)
      )
      
      // After swap: [3, 1, 2]
      // 3->2 (1), 2->3 (1), 1->2 (1), 2->1 (1) = 4
      expect(score).toBe(4)
    })

    it('handles swap where fromIndex is not in indices', () => {
      const indices = [1, 2, 3]
      const positions: [number, number, number][] = Array(6)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      const neighborMap = new Map([
        [0, [1]],
        [1, [0, 2]],
        [2, [1, 3]],
        [3, [2, 4]],
      ])
      
      const score = calculateSwappedContiguity(
        indices,
        positions,
        1.0,
        0, // not in indices
        4, // not in indices
        createNeighborMap(neighborMap)
      )
      
      // Original indices unchanged: [1, 2, 3]
      expect(score).toBe(4)
    })

    it('handles empty indices array', () => {
      const positions: [number, number, number][] = [[0, 0, 0]]
      const score = calculateSwappedContiguity([], positions, 1.0, 0, 1, createNeighborMap(new Map()))
      expect(score).toBe(0)
    })

    it('does not mutate original indices array', () => {
      const indices = [0, 1, 2]
      const originalIndices = [...indices]
      const positions: [number, number, number][] = Array(5)
        .fill(null)
        .map((_, i) => [i, 0, 0])
      
      calculateSwappedContiguity(
        indices,
        positions,
        1.0,
        0,
        3,
        createNeighborMap(new Map())
      )
      
      expect(indices).toEqual(originalIndices) // Should not be mutated
    })
  })

  describe('Integration: Real-world hexagonal grid scenario', () => {
    it('calculates correct metrics for a small hex cluster', () => {
      // Simulate a small hex grid (7 hexes in honeycomb pattern)
      //     0
      //   1   2
      //  3  4  5
      //     6
      const positions: [number, number, number][] = [
        [0, 2, 0], // 0 - top
        [-1, 1, 0], // 1 - middle left
        [1, 1, 0], // 2 - middle right
        [-2, 0, 0], // 3 - bottom left
        [0, 0, 0], // 4 - bottom center
        [2, 0, 0], // 5 - bottom right
        [0, -1, 0], // 6 - very bottom
      ]
      
      const bounds = getGridBounds(positions)
      expect(bounds.width).toBe(4)
      expect(bounds.height).toBe(3)
      
      // Check distances
      const dist04 = distanceBetween(positions[0], positions[4], bounds, false)
      expect(dist04).toBeCloseTo(2, 1)
      
      // Calculate UV for central hex in 3x3 texture grid
      const [minU, minV, maxU, maxV] = calculateUvBoundsFromGridPosition(1, 1, 3, 3)
      expect(maxU - minU).toBeCloseTo(1 / 3, 10)
      expect(maxV - minV).toBeCloseTo(1 / 3, 10)
    })
  })
})
