/**
 * Pure mathematical functions for hexgrid calculations.
 * These functions have NO side effects, NO logging, and NO mutable state access.
 * They are deterministic and testable in isolation.
 */

/**
 * Calculate the bounding box of a set of 2D/3D positions.
 * @pure - No side effects, deterministic
 * @param positions Array of [x, y, z] coordinates
 * @returns Object with min/max bounds and dimensions
 */
export function getGridBounds(positions: [number, number, number][]) {
  if (!positions || positions.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const p of positions) {
    if (!p) continue;
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }

  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Calculate Euclidean distance between two 3D points with optional spherical wrapping.
 * @pure - No side effects, deterministic
 * @param a First point [x, y, z]
 * @param b Second point [x, y, z]
 * @param bounds Grid bounds for spherical calculation
 * @param isSpherical Whether to apply spherical wrapping (toroidal distance)
 * @returns Euclidean distance
 */
export function distanceBetween(
  a: [number, number, number],
  b: [number, number, number],
  bounds: { width: number; height: number },
  isSpherical: boolean
): number {
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];

  if (isSpherical && bounds.width > 0 && bounds.height > 0) {
    // Apply toroidal wrapping: shortest distance considering wraparound
    if (Math.abs(dx) > bounds.width / 2) {
      dx = dx > 0 ? dx - bounds.width : dx + bounds.width;
    }
    if (Math.abs(dy) > bounds.height / 2) {
      dy = dy > 0 ? dy - bounds.height : dy + bounds.height;
    }
  }

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate UV texture coordinates for a tile based on its grid position.
 * @pure - No side effects, deterministic
 * @param gridCol Column index (0-based)
 * @param gridRow Row index (0-based)
 * @param tilesX Total number of columns in texture grid
 * @param tilesY Total number of rows in texture grid
 * @returns [minU, minV, maxU, maxV] in range [0, 1]
 *
 * Note: V=1.0 represents the top of the texture.
 * Row 0 maps to top, so maxV=1 and minV=1-1/tilesY.
 */
export function calculateUvBoundsFromGridPosition(
  gridCol: number,
  gridRow: number,
  tilesX: number,
  tilesY: number
): [number, number, number, number] {
  // Guard against invalid grid dimensions
  if (tilesX <= 0 || tilesY <= 0) {
    return [0, 0, 1, 1];
  }

  const minU = gridCol / tilesX;
  const maxU = (gridCol + 1) / tilesX;
  // V=1 is top, so row 0 maps to top (maxV=1, minV=1-1/tilesY)
  const minV = 1 - (gridRow + 1) / tilesY;
  const maxV = 1 - gridRow / tilesY;

  return [minU, minV, maxU, maxV];
}

/**
 * Calculate contiguity score between indices (internal connectivity).
 * Higher score means more indices in the set are neighbors with each other.
 * @pure - No side effects, deterministic
 * @param indices Set of position indices to measure
 * @param positions Array of all positions
 * @param hexRadius Radius for neighbor detection
 * @param getNeighbors Function to get neighbors for an index (dependency injection)
 * @returns Sum of neighbor connections within the set
 */
export function calculateContiguity(
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  getNeighbors: (index: number) => number[]
): number {
  if (!indices || indices.length === 0) return 0;
  if (!positions || positions.length === 0) return 0;
  if (hexRadius <= 0) return 0;

  const set = new Set(indices);
  let total = 0;

  for (const idx of indices) {
    const neighbors = getNeighbors(idx);
    for (const n of neighbors) {
      if (set.has(n)) total++;
    }
  }

  return total;
}

/**
 * Calculate contiguity score for a photo's indices.
 * @pure - No side effects, deterministic
 * @param indices Indices belonging to a photo
 * @param positions Array of all positions
 * @param hexRadius Radius for neighbor detection
 * @param getNeighbors Function to get neighbors for an index
 * @returns Total contiguity score
 */
export function calculatePhotoContiguity(
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  getNeighbors: (index: number) => number[]
): number {
  return calculateContiguity(indices, positions, hexRadius, getNeighbors);
}

/**
 * Calculate contiguity after a hypothetical swap of two indices.
 * @pure - No side effects, deterministic
 * @param indices Current indices
 * @param positions Array of all positions
 * @param hexRadius Radius for neighbor detection
 * @param fromIndex Index to swap from
 * @param toIndex Index to swap to
 * @param getNeighbors Function to get neighbors for an index
 * @returns Contiguity score after swap
 */
export function calculateSwappedContiguity(
  indices: number[],
  positions: [number, number, number][],
  hexRadius: number,
  fromIndex: number,
  toIndex: number,
  getNeighbors: (index: number) => number[]
): number {
  if (!indices || indices.length === 0) return 0;

  const tempIndices = [...indices];
  const fromPos = tempIndices.indexOf(fromIndex);
  const toPos = tempIndices.indexOf(toIndex);

  if (fromPos !== -1) tempIndices[fromPos] = toIndex;
  if (toPos !== -1) tempIndices[toPos] = fromIndex;

  return calculatePhotoContiguity(
    tempIndices,
    positions,
    hexRadius,
    getNeighbors
  );
}
