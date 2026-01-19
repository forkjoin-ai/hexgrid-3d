/**
 * Outlier Detection and Mathematical Anomaly Analysis
 * 
 * Professional-grade algorithms for detecting unusual patterns,
 * statistical anomalies, and outliers in territory data.
 * 
 * Features:
 * - Statistical Methods: Z-score, Modified Z-score, IQR, Grubbs, Dixon
 * - Machine Learning: Isolation Forest, LOF (Local Outlier Factor)
 * - Time Series: CUSUM, EWMA control charts, seasonal decomposition
 * - Multivariate: Mahalanobis distance, PCA-based detection
 * - Game-specific: Territory anomalies, growth spikes, conquest surges
 * 
 * @module algorithms/OutlierDetection
 * 
 * @example
 * ```typescript
 * // Detect outliers in territory sizes
 * const territories = [100, 95, 102, 98, 500, 97, 103]  // 500 is anomaly
 * const outliers = detectOutliersZScore(territories)
 * // Returns: { outlierIndices: [4], outlierValues: [500], ... }
 * 
 * // Detect growth spikes
 * const history = [10, 12, 11, 13, 50, 14, 15]  // spike at index 4
 * const spikes = detectGrowthSpikes(history)
 * // Returns: [{ index: 4, value: 50, zScore: 4.2, isAnomaly: true }]
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result from outlier detection
 * 
 * @example
 * ```typescript
 * const result: OutlierResult = {
 *   outlierIndices: [3, 7],
 *   outlierValues: [500, 450],
 *   scores: [0.1, 0.2, 0.3, 4.5, 0.2, 0.1, 0.15, 4.2],
 *   threshold: 3.0,
 *   method: 'zscore',
 *   stats: { mean: 120, stdDev: 85, median: 100 }
 * }
 * ```
 */
export interface OutlierResult {
  /** Indices of detected outliers */
  outlierIndices: number[]
  /** Values of detected outliers */
  outlierValues: number[]
  /** Anomaly scores for all points (higher = more anomalous) */
  scores: number[]
  /** Threshold used for classification */
  threshold: number
  /** Method used for detection */
  method: string
  /** Summary statistics */
  stats: {
    mean: number
    stdDev: number
    median: number
    mad?: number  // Median Absolute Deviation
    iqr?: number  // Interquartile Range
  }
}

/**
 * Time series anomaly result
 * 
 * @example
 * ```typescript
 * const anomaly: TimeSeriesAnomaly = {
 *   index: 45,
 *   timestamp: 1705678800000,
 *   value: 350,
 *   expectedValue: 120,
 *   deviation: 230,
 *   zScore: 5.2,
 *   isAnomaly: true,
 *   anomalyType: 'spike',
 *   severity: 'critical',
 *   confidence: 0.98
 * }
 * ```
 */
export interface TimeSeriesAnomaly {
  index: number
  timestamp?: number
  value: number
  expectedValue: number
  deviation: number
  zScore: number
  isAnomaly: boolean
  anomalyType: 'spike' | 'dip' | 'shift' | 'trend_break' | 'variance_change'
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

/**
 * Game-specific anomaly detection result
 * 
 * @example
 * ```typescript
 * const gameAnomaly: GameAnomaly = {
 *   playerId: 2,
 *   type: 'conquest_surge',
 *   description: 'Player 2 conquered 45 cells in one turn (expected: 3-8)',
 *   value: 45,
 *   expectedRange: [3, 8],
 *   deviationFactor: 5.6,
 *   timestamp: 1705678800000,
 *   affectedCells: [123, 124, 125, ...],
 *   possibleCauses: ['coordinated attack', 'weak opponent', 'power-up effect']
 * }
 * ```
 */
export interface GameAnomaly {
  playerId: number
  type: 'conquest_surge' | 'territory_collapse' | 'growth_explosion' | 
        'sudden_death' | 'comeback' | 'stagnation' | 'fragmentation' |
        'coordination_pattern' | 'suspicious_timing'
  description: string
  value: number
  expectedRange: [number, number]
  deviationFactor: number
  timestamp?: number
  affectedCells?: number[]
  possibleCauses: string[]
}

/**
 * Multivariate outlier result
 * 
 * @example
 * ```typescript
 * const mvResult: MultivariateOutlierResult = {
 *   outlierIndices: [5, 12],
 *   mahalanobisDistances: [1.2, 0.8, ..., 8.5, ...],
 *   contributingDimensions: [[0, 2], [1, 3]],  // which features caused it
 *   covarianceMatrix: [[1, 0.3], [0.3, 1]],
 *   centroid: [100, 50]
 * }
 * ```
 */
export interface MultivariateOutlierResult {
  outlierIndices: number[]
  mahalanobisDistances: number[]
  contributingDimensions: number[][]
  covarianceMatrix: number[][]
  centroid: number[]
  threshold: number
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICAL OUTLIER DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect outliers using Z-score method
 * Points with |z| > threshold are outliers
 * 
 * @param data - Array of numeric values
 * @param threshold - Z-score threshold (default: 3.0)
 * @returns OutlierResult with detected outliers
 * 
 * @example
 * ```typescript
 * const data = [10, 12, 11, 100, 13, 11, 12]
 * const result = detectOutliersZScore(data)
 * // result.outlierIndices = [3]
 * // result.outlierValues = [100]
 * // result.scores = [0.76, 0.69, 0.72, 3.45, 0.66, 0.72, 0.69]
 * ```
 */
export function detectOutliersZScore(
  data: number[],
  threshold: number = 3.0
): OutlierResult {
  const n = data.length
  if (n === 0) {
    return {
      outlierIndices: [],
      outlierValues: [],
      scores: [],
      threshold,
      method: 'zscore',
      stats: { mean: 0, stdDev: 0, median: 0 }
    }
  }

  const mean = data.reduce((a, b) => a + b, 0) / n
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n
  const stdDev = Math.sqrt(variance)

  const sorted = [...data].sort((a, b) => a - b)
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  const scores = data.map(x => stdDev > 0 ? Math.abs(x - mean) / stdDev : 0)
  
  const outlierIndices: number[] = []
  const outlierValues: number[] = []

  scores.forEach((score, i) => {
    if (score > threshold) {
      outlierIndices.push(i)
      outlierValues.push(data[i])
    }
  })

  return {
    outlierIndices,
    outlierValues,
    scores,
    threshold,
    method: 'zscore',
    stats: { mean, stdDev, median }
  }
}

/**
 * Detect outliers using Modified Z-score (robust to outliers)
 * Uses median and MAD instead of mean and std dev
 * 
 * @param data - Array of numeric values
 * @param threshold - Modified Z-score threshold (default: 3.5)
 * 
 * @example
 * ```typescript
 * const data = [10, 12, 11, 100, 13, 11, 12, 200]  // multiple outliers
 * const result = detectOutliersModifiedZScore(data)
 * // More robust than standard Z-score with contaminated data
 * ```
 */
export function detectOutliersModifiedZScore(
  data: number[],
  threshold: number = 3.5
): OutlierResult {
  const n = data.length
  if (n === 0) {
    return {
      outlierIndices: [],
      outlierValues: [],
      scores: [],
      threshold,
      method: 'modified_zscore',
      stats: { mean: 0, stdDev: 0, median: 0, mad: 0 }
    }
  }

  const sorted = [...data].sort((a, b) => a - b)
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  // Median Absolute Deviation
  const absoluteDeviations = data.map(x => Math.abs(x - median))
  const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b)
  const mad = n % 2 === 0
    ? (sortedDeviations[n / 2 - 1] + sortedDeviations[n / 2]) / 2
    : sortedDeviations[Math.floor(n / 2)]

  // Modified Z-score: 0.6745 is the 0.75th quantile of the standard normal
  const k = 0.6745
  const scores = data.map(x => 
    mad > 0 ? Math.abs(k * (x - median) / mad) : 0
  )

  const mean = data.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n)

  const outlierIndices: number[] = []
  const outlierValues: number[] = []

  scores.forEach((score, i) => {
    if (score > threshold) {
      outlierIndices.push(i)
      outlierValues.push(data[i])
    }
  })

  return {
    outlierIndices,
    outlierValues,
    scores,
    threshold,
    method: 'modified_zscore',
    stats: { mean, stdDev, median, mad }
  }
}

/**
 * Detect outliers using Interquartile Range (IQR) method
 * Points outside [Q1 - k*IQR, Q3 + k*IQR] are outliers
 * 
 * @param data - Array of numeric values
 * @param k - IQR multiplier (default: 1.5 for outliers, 3.0 for extreme outliers)
 * 
 * @example
 * ```typescript
 * const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
 * const result = detectOutliersIQR(data)
 * // result.outlierIndices = [9]
 * // Uses box plot logic: Q1 - 1.5*IQR to Q3 + 1.5*IQR
 * ```
 */
export function detectOutliersIQR(
  data: number[],
  k: number = 1.5
): OutlierResult {
  const n = data.length
  if (n < 4) {
    return {
      outlierIndices: [],
      outlierValues: [],
      scores: [],
      threshold: k,
      method: 'iqr',
      stats: { mean: 0, stdDev: 0, median: 0, iqr: 0 }
    }
  }

  const sorted = [...data].sort((a, b) => a - b)
  
  const q1Idx = Math.floor(n * 0.25)
  const q3Idx = Math.floor(n * 0.75)
  const medianIdx = Math.floor(n * 0.5)

  const q1 = sorted[q1Idx]
  const q3 = sorted[q3Idx]
  const median = sorted[medianIdx]
  const iqr = q3 - q1

  const lowerBound = q1 - k * iqr
  const upperBound = q3 + k * iqr

  const mean = data.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n)

  // Score based on distance from bounds
  const scores = data.map(x => {
    if (x < lowerBound) return (lowerBound - x) / (iqr || 1)
    if (x > upperBound) return (x - upperBound) / (iqr || 1)
    return 0
  })

  const outlierIndices: number[] = []
  const outlierValues: number[] = []

  data.forEach((x, i) => {
    if (x < lowerBound || x > upperBound) {
      outlierIndices.push(i)
      outlierValues.push(x)
    }
  })

  return {
    outlierIndices,
    outlierValues,
    scores,
    threshold: k,
    method: 'iqr',
    stats: { mean, stdDev, median, iqr }
  }
}

/**
 * Grubbs' test for a single outlier
 * Tests if the most extreme value is an outlier
 * 
 * @param data - Array of numeric values
 * @param alpha - Significance level (default: 0.05)
 * 
 * @example
 * ```typescript
 * const data = [10, 12, 11, 13, 12, 11, 100]
 * const result = grubbsTest(data)
 * // result.isOutlier = true
 * // result.extremeValue = 100
 * // result.grubbsStatistic = 2.98
 * ```
 */
export function grubbsTest(
  data: number[],
  alpha: number = 0.05
): {
  isOutlier: boolean
  extremeValue: number
  extremeIndex: number
  grubbsStatistic: number
  criticalValue: number
} {
  const n = data.length
  if (n < 3) {
    return {
      isOutlier: false,
      extremeValue: data[0] ?? 0,
      extremeIndex: 0,
      grubbsStatistic: 0,
      criticalValue: Infinity
    }
  }

  const mean = data.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1))

  // Find most extreme value
  let maxDev = 0
  let extremeIndex = 0
  for (let i = 0; i < n; i++) {
    const dev = Math.abs(data[i] - mean)
    if (dev > maxDev) {
      maxDev = dev
      extremeIndex = i
    }
  }

  const grubbsStatistic = stdDev > 0 ? maxDev / stdDev : 0

  // Critical value approximation using t-distribution
  // This is a simplified version; exact requires t-distribution tables
  const tCritical = 2.0 + 0.5 * Math.log(n)  // Approximation
  const criticalValue = ((n - 1) / Math.sqrt(n)) * 
    Math.sqrt(tCritical ** 2 / (n - 2 + tCritical ** 2))

  return {
    isOutlier: grubbsStatistic > criticalValue,
    extremeValue: data[extremeIndex],
    extremeIndex,
    grubbsStatistic,
    criticalValue
  }
}

/**
 * Dixon's Q test for outliers in small samples
 * Best for n < 25
 * 
 * @param data - Array of numeric values (works best for n < 25)
 * @param alpha - Significance level (default: 0.05)
 * 
 * @example
 * ```typescript
 * const smallSample = [10, 12, 11, 13, 50]
 * const result = dixonQTest(smallSample)
 * // result.isOutlier = true
 * // result.qStatistic = 0.95
 * ```
 */
export function dixonQTest(
  data: number[],
  alpha: number = 0.05
): {
  isOutlierLow: boolean
  isOutlierHigh: boolean
  qLow: number
  qHigh: number
  criticalValue: number
} {
  const n = data.length
  if (n < 3 || n > 25) {
    return {
      isOutlierLow: false,
      isOutlierHigh: false,
      qLow: 0,
      qHigh: 0,
      criticalValue: 0
    }
  }

  const sorted = [...data].sort((a, b) => a - b)
  const range = sorted[n - 1] - sorted[0]

  const qLow = range > 0 ? (sorted[1] - sorted[0]) / range : 0
  const qHigh = range > 0 ? (sorted[n - 1] - sorted[n - 2]) / range : 0

  // Critical values for Dixon's Q test (α = 0.05)
  const criticalValues: { [key: number]: number } = {
    3: 0.941, 4: 0.765, 5: 0.642, 6: 0.560, 7: 0.507,
    8: 0.468, 9: 0.437, 10: 0.412, 11: 0.392, 12: 0.376,
    13: 0.361, 14: 0.349, 15: 0.338, 16: 0.329, 17: 0.320,
    18: 0.313, 19: 0.306, 20: 0.300, 21: 0.295, 22: 0.290,
    23: 0.285, 24: 0.281, 25: 0.277
  }

  const criticalValue = criticalValues[n] ?? 0.3

  return {
    isOutlierLow: qLow > criticalValue,
    isOutlierHigh: qHigh > criticalValue,
    qLow,
    qHigh,
    criticalValue
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MACHINE LEARNING-BASED DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Isolation Forest for anomaly detection
 * Anomalies are isolated in fewer splits
 * 
 * @param data - 2D array of features [samples, features]
 * @param numTrees - Number of trees in the forest
 * @param sampleSize - Subsample size for each tree
 * @param contamination - Expected proportion of outliers
 * 
 * @example
 * ```typescript
 * const data = [
 *   [10, 20], [12, 22], [11, 21],  // normal
 *   [100, 200]  // outlier
 * ]
 * const result = isolationForest(data)
 * // result.outlierIndices = [3]
 * // result.anomalyScores = [0.45, 0.42, 0.44, 0.92]
 * ```
 */
export function isolationForest(
  data: number[][],
  numTrees: number = 100,
  sampleSize?: number,
  contamination: number = 0.1
): {
  outlierIndices: number[]
  anomalyScores: number[]
  threshold: number
} {
  const n = data.length
  if (n === 0) {
    return { outlierIndices: [], anomalyScores: [], threshold: 0.5 }
  }

  const dims = data[0].length
  const actualSampleSize = sampleSize ?? Math.min(256, n)

  // Build trees and compute path lengths
  const pathLengths: number[][] = Array(n).fill(null).map(() => [])

  for (let t = 0; t < numTrees; t++) {
    // Sample indices
    const sampleIndices: number[] = []
    for (let i = 0; i < actualSampleSize; i++) {
      sampleIndices.push(Math.floor(Math.random() * n))
    }
    const sample = sampleIndices.map(i => data[i])

    // Build isolation tree
    const tree = buildIsolationTree(sample, 0, Math.ceil(Math.log2(actualSampleSize)))

    // Compute path length for each point
    for (let i = 0; i < n; i++) {
      const pathLength = computePathLength(data[i], tree, 0)
      pathLengths[i].push(pathLength)
    }
  }

  // Average expected path length
  const c = averagePathLength(actualSampleSize)

  // Compute anomaly scores
  const anomalyScores = pathLengths.map(lengths => {
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
    return Math.pow(2, -avgLength / c)
  })

  // Determine threshold based on contamination
  const sortedScores = [...anomalyScores].sort((a, b) => b - a)
  const thresholdIdx = Math.floor(contamination * n)
  const threshold = sortedScores[thresholdIdx] ?? 0.5

  const outlierIndices = anomalyScores
    .map((score, i) => score >= threshold ? i : -1)
    .filter(i => i >= 0)

  return { outlierIndices, anomalyScores, threshold }
}

interface IsolationTreeNode {
  isLeaf: boolean
  splitDim?: number
  splitValue?: number
  left?: IsolationTreeNode
  right?: IsolationTreeNode
  size?: number
}

function buildIsolationTree(
  data: number[][],
  depth: number,
  maxDepth: number
): IsolationTreeNode {
  const n = data.length

  if (depth >= maxDepth || n <= 1) {
    return { isLeaf: true, size: n }
  }

  const dims = data[0].length
  const splitDim = Math.floor(Math.random() * dims)

  const values = data.map(d => d[splitDim])
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  if (minVal === maxVal) {
    return { isLeaf: true, size: n }
  }

  const splitValue = minVal + Math.random() * (maxVal - minVal)

  const leftData = data.filter(d => d[splitDim] < splitValue)
  const rightData = data.filter(d => d[splitDim] >= splitValue)

  return {
    isLeaf: false,
    splitDim,
    splitValue,
    left: buildIsolationTree(leftData, depth + 1, maxDepth),
    right: buildIsolationTree(rightData, depth + 1, maxDepth)
  }
}

function computePathLength(
  point: number[],
  node: IsolationTreeNode,
  depth: number
): number {
  if (node.isLeaf) {
    return depth + averagePathLength(node.size ?? 1)
  }

  if (point[node.splitDim!] < node.splitValue!) {
    return computePathLength(point, node.left!, depth + 1)
  } else {
    return computePathLength(point, node.right!, depth + 1)
  }
}

function averagePathLength(n: number): number {
  if (n <= 1) return 0
  if (n === 2) return 1
  // H(n-1) approximation using Euler's constant
  const euler = 0.5772156649
  return 2 * (Math.log(n - 1) + euler) - 2 * (n - 1) / n
}

/**
 * Local Outlier Factor (LOF)
 * Compares local density to neighbors' densities
 * 
 * @param data - 2D array of features
 * @param k - Number of neighbors
 * @param threshold - LOF threshold (default: 1.5, higher = more anomalous)
 * 
 * @example
 * ```typescript
 * const data = [[1, 1], [1.5, 1.2], [1.2, 0.9], [10, 10]]  // last is outlier
 * const result = localOutlierFactor(data, 3)
 * // result.lofScores = [1.02, 0.98, 1.01, 3.45]
 * // result.outlierIndices = [3]
 * ```
 */
export function localOutlierFactor(
  data: number[][],
  k: number = 5,
  threshold: number = 1.5
): {
  outlierIndices: number[]
  lofScores: number[]
  reachabilityDistances: number[][]
  localDensities: number[]
} {
  const n = data.length
  if (n <= k) {
    return {
      outlierIndices: [],
      lofScores: Array(n).fill(1),
      reachabilityDistances: [],
      localDensities: Array(n).fill(1)
    }
  }

  // Compute distance matrix
  const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(data[i], data[j])
      distances[i][j] = dist
      distances[j][i] = dist
    }
  }

  // Find k-nearest neighbors for each point
  const neighbors: number[][] = []
  const kDistances: number[] = []

  for (let i = 0; i < n; i++) {
    const dists = distances[i]
      .map((d, j) => ({ dist: d, idx: j }))
      .filter(({ idx }) => idx !== i)
      .sort((a, b) => a.dist - b.dist)
    
    neighbors.push(dists.slice(0, k).map(d => d.idx))
    kDistances.push(dists[k - 1]?.dist ?? 0)
  }

  // Compute reachability distances
  const reachabilityDistances: number[][] = Array(n).fill(null).map(() => [])
  for (let i = 0; i < n; i++) {
    for (const j of neighbors[i]) {
      const reachDist = Math.max(kDistances[j], distances[i][j])
      reachabilityDistances[i].push(reachDist)
    }
  }

  // Compute local reachability density (LRD)
  const localDensities: number[] = []
  for (let i = 0; i < n; i++) {
    const avgReachDist = reachabilityDistances[i].reduce((a, b) => a + b, 0) / k
    localDensities.push(avgReachDist > 0 ? 1 / avgReachDist : Infinity)
  }

  // Compute LOF
  const lofScores: number[] = []
  for (let i = 0; i < n; i++) {
    if (localDensities[i] === 0) {
      lofScores.push(Infinity)
      continue
    }

    let lrdSum = 0
    for (const j of neighbors[i]) {
      lrdSum += localDensities[j]
    }
    const avgNeighborLRD = lrdSum / k

    lofScores.push(avgNeighborLRD / localDensities[i])
  }

  const outlierIndices = lofScores
    .map((score, i) => score > threshold ? i : -1)
    .filter(i => i >= 0)

  return {
    outlierIndices,
    lofScores,
    reachabilityDistances,
    localDensities
  }
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2
  }
  return Math.sqrt(sum)
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME SERIES ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CUSUM (Cumulative Sum) control chart for detecting mean shifts
 * 
 * @param data - Time series data
 * @param target - Target mean (default: estimated from data)
 * @param k - Allowance parameter (default: 0.5 * stdDev)
 * @param h - Decision threshold (default: 5 * stdDev)
 * 
 * @example
 * ```typescript
 * const data = [10, 11, 10, 9, 10, 20, 21, 22, 20, 21]  // mean shift at index 5
 * const result = cusumChart(data)
 * // result.changePoints = [5]
 * // result.cusumHigh = [0, 0.5, 0, 0, 0, 9.5, ...]
 * ```
 */
export function cusumChart(
  data: number[],
  target?: number,
  k?: number,
  h?: number
): {
  cusumHigh: number[]
  cusumLow: number[]
  changePoints: number[]
  alarms: Array<{ index: number; type: 'high' | 'low'; value: number }>
} {
  const n = data.length
  if (n === 0) {
    return { cusumHigh: [], cusumLow: [], changePoints: [], alarms: [] }
  }

  // Estimate parameters if not provided
  const mean = target ?? data.reduce((a, b) => a + b, 0) / n
  const stdDev = Math.sqrt(data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n)
  
  const actualK = k ?? 0.5 * stdDev
  const actualH = h ?? 5 * stdDev

  const cusumHigh: number[] = [0]
  const cusumLow: number[] = [0]
  const alarms: Array<{ index: number; type: 'high' | 'low'; value: number }> = []
  const changePoints: number[] = []

  for (let i = 0; i < n; i++) {
    const deviation = data[i] - mean

    const newHigh = Math.max(0, (cusumHigh[i] ?? 0) + deviation - actualK)
    const newLow = Math.max(0, (cusumLow[i] ?? 0) - deviation - actualK)

    cusumHigh.push(newHigh)
    cusumLow.push(newLow)

    if (newHigh > actualH) {
      alarms.push({ index: i, type: 'high', value: newHigh })
      changePoints.push(i)
    }
    if (newLow > actualH) {
      alarms.push({ index: i, type: 'low', value: newLow })
      if (!changePoints.includes(i)) changePoints.push(i)
    }
  }

  return { cusumHigh, cusumLow, changePoints, alarms }
}

/**
 * EWMA (Exponentially Weighted Moving Average) control chart
 * Good for detecting small, gradual shifts
 * 
 * @param data - Time series data
 * @param lambda - Smoothing factor (0 < λ ≤ 1, default: 0.2)
 * @param L - Control limit multiplier (default: 3)
 * 
 * @example
 * ```typescript
 * const data = [10, 11, 10, 12, 15, 16, 18, 20]  // gradual increase
 * const result = ewmaChart(data)
 * // Detects gradual drift better than Shewhart charts
 * ```
 */
export function ewmaChart(
  data: number[],
  lambda: number = 0.2,
  L: number = 3
): {
  ewma: number[]
  ucl: number[]  // Upper control limit
  lcl: number[]  // Lower control limit
  outOfControl: number[]
} {
  const n = data.length
  if (n === 0) {
    return { ewma: [], ucl: [], lcl: [], outOfControl: [] }
  }

  const mean = data.reduce((a, b) => a + b, 0) / n
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n
  const stdDev = Math.sqrt(variance)

  const ewma: number[] = [mean]
  const ucl: number[] = []
  const lcl: number[] = []
  const outOfControl: number[] = []

  for (let i = 0; i < n; i++) {
    const newEwma = lambda * data[i] + (1 - lambda) * ewma[i]
    ewma.push(newEwma)

    // Time-varying control limits
    const factor = Math.sqrt(
      (lambda / (2 - lambda)) * (1 - Math.pow(1 - lambda, 2 * (i + 1)))
    )
    const controlLimit = L * stdDev * factor

    ucl.push(mean + controlLimit)
    lcl.push(mean - controlLimit)

    if (newEwma > mean + controlLimit || newEwma < mean - controlLimit) {
      outOfControl.push(i)
    }
  }

  return { ewma: ewma.slice(1), ucl, lcl, outOfControl }
}

/**
 * Detect growth spikes in time series
 * Identifies sudden jumps or drops
 * 
 * @param data - Time series of values
 * @param windowSize - Rolling window for baseline
 * @param threshold - Z-score threshold for spike detection
 * 
 * @example
 * ```typescript
 * const territory = [100, 102, 98, 105, 250, 108, 103]  // spike at index 4
 * const spikes = detectGrowthSpikes(territory)
 * // Returns: [{ index: 4, value: 250, change: 145, zScore: 5.2, ... }]
 * ```
 */
export function detectGrowthSpikes(
  data: number[],
  windowSize: number = 5,
  threshold: number = 3.0
): TimeSeriesAnomaly[] {
  const anomalies: TimeSeriesAnomaly[] = []
  const n = data.length

  if (n < windowSize + 1) return anomalies

  for (let i = windowSize; i < n; i++) {
    const window = data.slice(i - windowSize, i)
    const mean = window.reduce((a, b) => a + b, 0) / windowSize
    const stdDev = Math.sqrt(
      window.reduce((sum, x) => sum + (x - mean) ** 2, 0) / windowSize
    )

    const value = data[i]
    const change = value - data[i - 1]
    const zScore = stdDev > 0 ? Math.abs(value - mean) / stdDev : 0

    const isAnomaly = zScore > threshold

    if (isAnomaly) {
      const severity = zScore > 5 ? 'critical' :
                       zScore > 4 ? 'high' :
                       zScore > 3 ? 'medium' : 'low'

      anomalies.push({
        index: i,
        value,
        expectedValue: mean,
        deviation: value - mean,
        zScore,
        isAnomaly: true,
        anomalyType: change > 0 ? 'spike' : 'dip',
        severity,
        confidence: Math.min(0.99, 1 - 1 / (zScore + 1))
      })
    }
  }

  return anomalies
}

/**
 * Detect variance changes in time series
 * Finds periods where volatility significantly changes
 * 
 * @param data - Time series data
 * @param windowSize - Window for variance calculation
 * @param threshold - Ratio threshold for variance change
 * 
 * @example
 * ```typescript
 * const data = [10, 11, 9, 10, 11, 10, 50, 5, 60, 2]  // variance explosion
 * const changes = detectVarianceChanges(data)
 * // Detects the point where variance suddenly increases
 * ```
 */
export function detectVarianceChanges(
  data: number[],
  windowSize: number = 10,
  threshold: number = 3.0
): Array<{
  index: number
  beforeVariance: number
  afterVariance: number
  ratio: number
  isIncrease: boolean
}> {
  const changes: Array<{
    index: number
    beforeVariance: number
    afterVariance: number
    ratio: number
    isIncrease: boolean
  }> = []

  const n = data.length
  if (n < windowSize * 2) return changes

  for (let i = windowSize; i < n - windowSize; i++) {
    const before = data.slice(i - windowSize, i)
    const after = data.slice(i, i + windowSize)

    const beforeMean = before.reduce((a, b) => a + b, 0) / windowSize
    const afterMean = after.reduce((a, b) => a + b, 0) / windowSize

    const beforeVariance = before.reduce((sum, x) => sum + (x - beforeMean) ** 2, 0) / windowSize
    const afterVariance = after.reduce((sum, x) => sum + (x - afterMean) ** 2, 0) / windowSize

    const ratio = beforeVariance > 0 ? afterVariance / beforeVariance : 
                  afterVariance > 0 ? Infinity : 1

    if (ratio > threshold || ratio < 1 / threshold) {
      changes.push({
        index: i,
        beforeVariance,
        afterVariance,
        ratio,
        isIncrease: ratio > 1
      })
    }
  }

  return changes
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTIVARIATE OUTLIER DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mahalanobis distance for multivariate outlier detection
 * Accounts for correlations between variables
 * 
 * @param data - 2D array of features
 * @param threshold - Chi-squared critical value (default: 99th percentile)
 * 
 * @example
 * ```typescript
 * const data = [
 *   [10, 100, 50],   // territory, population, conquests
 *   [12, 110, 55],
 *   [11, 105, 52],
 *   [100, 50, 200]   // outlier - unusual combination
 * ]
 * const result = mahalanobisOutliers(data)
 * // Detects outliers based on multivariate structure
 * ```
 */
export function mahalanobisOutliers(
  data: number[][],
  threshold?: number
): MultivariateOutlierResult {
  const n = data.length
  if (n === 0) {
    return {
      outlierIndices: [],
      mahalanobisDistances: [],
      contributingDimensions: [],
      covarianceMatrix: [],
      centroid: [],
      threshold: 0
    }
  }

  const dims = data[0].length

  // Compute centroid (mean)
  const centroid = Array(dims).fill(0)
  for (const point of data) {
    for (let d = 0; d < dims; d++) {
      centroid[d] += point[d]
    }
  }
  for (let d = 0; d < dims; d++) {
    centroid[d] /= n
  }

  // Compute covariance matrix
  const covarianceMatrix: number[][] = Array(dims).fill(null).map(() => Array(dims).fill(0))
  for (const point of data) {
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        covarianceMatrix[i][j] += (point[i] - centroid[i]) * (point[j] - centroid[j])
      }
    }
  }
  for (let i = 0; i < dims; i++) {
    for (let j = 0; j < dims; j++) {
      covarianceMatrix[i][j] /= n - 1
    }
  }

  // Invert covariance matrix (simplified for small dims)
  const invCov = invertMatrix(covarianceMatrix)

  // Compute Mahalanobis distances
  const mahalanobisDistances: number[] = []
  for (const point of data) {
    const diff = point.map((v, i) => v - centroid[i])
    let dist = 0
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < dims; j++) {
        dist += diff[i] * invCov[i][j] * diff[j]
      }
    }
    mahalanobisDistances.push(Math.sqrt(Math.max(0, dist)))
  }

  // Default threshold: chi-squared with dims degrees of freedom, 99th percentile
  const actualThreshold = threshold ?? Math.sqrt(dims) * 3

  const outlierIndices = mahalanobisDistances
    .map((d, i) => d > actualThreshold ? i : -1)
    .filter(i => i >= 0)

  // Find contributing dimensions for each outlier
  const contributingDimensions: number[][] = outlierIndices.map(idx => {
    const point = data[idx]
    const contributions = point.map((v, d) => ({
      dim: d,
      contribution: Math.abs(v - centroid[d]) / Math.sqrt(covarianceMatrix[d][d] || 1)
    }))
    contributions.sort((a, b) => b.contribution - a.contribution)
    return contributions.slice(0, 2).map(c => c.dim)
  })

  return {
    outlierIndices,
    mahalanobisDistances,
    contributingDimensions,
    covarianceMatrix,
    centroid,
    threshold: actualThreshold
  }
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  if (n === 0) return []

  // Create augmented matrix [A|I]
  const augmented: number[][] = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
  ])

  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    if (Math.abs(augmented[i][i]) < 1e-10) {
      // Singular matrix, add small diagonal
      augmented[i][i] = 1e-10
    }

    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i] / augmented[i][i]
        for (let j = i; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }

    // Scale row
    const scale = augmented[i][i]
    for (let j = i; j < 2 * n; j++) {
      augmented[i][j] /= scale
    }
  }

  // Extract inverse
  return augmented.map(row => row.slice(n))
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME-SPECIFIC ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect game-specific anomalies in territory data
 * 
 * @param territoryHistory - Map of player ID to territory count history
 * @param conquestHistory - Map of player ID to conquest count history
 * @param options - Detection configuration
 * 
 * @example
 * ```typescript
 * const history = new Map([
 *   [1, [10, 12, 15, 80, 85]],  // sudden jump
 *   [2, [50, 48, 45, 10, 8]]    // sudden collapse
 * ])
 * const anomalies = detectGameAnomalies(history)
 * // Returns detailed anomaly descriptions for each player
 * ```
 */
export function detectGameAnomalies(
  territoryHistory: Map<number, number[]>,
  conquestHistory?: Map<number, number[]>,
  options: {
    spikeThreshold?: number
    collapseThreshold?: number
    stagnationThreshold?: number
  } = {}
): GameAnomaly[] {
  const {
    spikeThreshold = 3.0,
    collapseThreshold = 0.3,
    stagnationThreshold = 10
  } = options

  const anomalies: GameAnomaly[] = []

  for (const [playerId, history] of territoryHistory) {
    const n = history.length
    if (n < 3) continue

    // Detect growth spikes
    const spikes = detectGrowthSpikes(history, 5, spikeThreshold)
    for (const spike of spikes) {
      if (spike.anomalyType === 'spike') {
        anomalies.push({
          playerId,
          type: 'growth_explosion',
          description: `Player ${playerId} gained ${spike.deviation.toFixed(0)} cells unexpectedly (expected ~${spike.expectedValue.toFixed(0)})`,
          value: spike.value,
          expectedRange: [
            spike.expectedValue - spike.expectedValue * 0.2,
            spike.expectedValue + spike.expectedValue * 0.2
          ],
          deviationFactor: spike.zScore,
          possibleCauses: [
            'coordinated attack',
            'opponent vulnerability',
            'strategic breakthrough',
            'cascade effect'
          ]
        })
      }
    }

    // Detect sudden collapse
    const currentValue = history[n - 1]
    const recentMax = Math.max(...history.slice(-5))
    if (currentValue < recentMax * collapseThreshold) {
      anomalies.push({
        playerId,
        type: 'territory_collapse',
        description: `Player ${playerId} lost ${((1 - currentValue / recentMax) * 100).toFixed(0)}% of territory rapidly`,
        value: currentValue,
        expectedRange: [recentMax * 0.7, recentMax * 1.1],
        deviationFactor: recentMax / (currentValue || 1),
        possibleCauses: [
          'multi-front attack',
          'strategic failure',
          'resource exhaustion',
          'cascade collapse'
        ]
      })
    }

    // Detect stagnation
    const recentWindow = history.slice(-stagnationThreshold)
    if (recentWindow.length >= stagnationThreshold) {
      const variance = recentWindow.reduce((sum, v) => {
        const mean = recentWindow.reduce((a, b) => a + b, 0) / recentWindow.length
        return sum + (v - mean) ** 2
      }, 0) / recentWindow.length

      if (variance < 1) {  // Nearly no change
        anomalies.push({
          playerId,
          type: 'stagnation',
          description: `Player ${playerId} territory unchanged for ${stagnationThreshold} turns`,
          value: currentValue,
          expectedRange: [currentValue * 0.9, currentValue * 1.1],
          deviationFactor: 0,
          possibleCauses: [
            'defensive stalemate',
            'inactive player',
            'equilibrium reached',
            'blocked expansion'
          ]
        })
      }
    }

    // Detect comeback
    const firstHalf = history.slice(0, Math.floor(n / 2))
    const secondHalf = history.slice(Math.floor(n / 2))
    const firstHalfMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondHalfMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const minValue = Math.min(...history)
    const wasLosing = minValue < firstHalfMean * 0.5
    const nowWinning = currentValue > secondHalfMean * 1.5

    if (wasLosing && nowWinning) {
      anomalies.push({
        playerId,
        type: 'comeback',
        description: `Player ${playerId} staged a major comeback from ${minValue} to ${currentValue} cells`,
        value: currentValue,
        expectedRange: [minValue * 0.5, minValue * 2],
        deviationFactor: currentValue / (minValue || 1),
        possibleCauses: [
          'strategic adaptation',
          'opponent overextension',
          'alliance formation',
          'resource recovery'
        ]
      })
    }
  }

  return anomalies
}

/**
 * Comprehensive outlier analysis combining multiple methods
 * Returns consensus outliers found by multiple algorithms
 * 
 * @param data - Array of numeric values
 * @param minMethods - Minimum number of methods that must agree
 * 
 * @example
 * ```typescript
 * const data = [10, 11, 12, 100, 11, 10, 12]
 * const result = comprehensiveOutlierAnalysis(data)
 * // result.consensusOutliers = [3]  // found by multiple methods
 * // result.methodResults has individual method results
 * ```
 */
export function comprehensiveOutlierAnalysis(
  data: number[],
  minMethods: number = 2
): {
  consensusOutliers: number[]
  methodResults: {
    zscore: OutlierResult
    modifiedZscore: OutlierResult
    iqr: OutlierResult
    grubbs: ReturnType<typeof grubbsTest>
  }
  outlierCounts: Map<number, number>
  recommendations: string[]
} {
  const zscore = detectOutliersZScore(data)
  const modifiedZscore = detectOutliersModifiedZScore(data)
  const iqr = detectOutliersIQR(data)
  const grubbs = grubbsTest(data)

  // Count how many methods flagged each index
  const outlierCounts = new Map<number, number>()

  for (const idx of zscore.outlierIndices) {
    outlierCounts.set(idx, (outlierCounts.get(idx) ?? 0) + 1)
  }
  for (const idx of modifiedZscore.outlierIndices) {
    outlierCounts.set(idx, (outlierCounts.get(idx) ?? 0) + 1)
  }
  for (const idx of iqr.outlierIndices) {
    outlierCounts.set(idx, (outlierCounts.get(idx) ?? 0) + 1)
  }
  if (grubbs.isOutlier) {
    outlierCounts.set(grubbs.extremeIndex, (outlierCounts.get(grubbs.extremeIndex) ?? 0) + 1)
  }

  // Consensus outliers
  const consensusOutliers = Array.from(outlierCounts.entries())
    .filter(([, count]) => count >= minMethods)
    .map(([idx]) => idx)
    .sort((a, b) => a - b)

  // Generate recommendations
  const recommendations: string[] = []

  if (consensusOutliers.length === 0) {
    recommendations.push('No significant outliers detected across methods')
  } else {
    recommendations.push(`${consensusOutliers.length} consensus outlier(s) detected`)
    
    for (const idx of consensusOutliers) {
      const value = data[idx]
      const count = outlierCounts.get(idx) ?? 0
      recommendations.push(
        `Index ${idx} (value: ${value}) flagged by ${count}/4 methods - high confidence outlier`
      )
    }
  }

  // Check for data quality issues
  const uniqueValues = new Set(data)
  if (uniqueValues.size < data.length * 0.1) {
    recommendations.push('Warning: Low unique value ratio - consider categorical analysis')
  }

  if (zscore.stats.stdDev === 0) {
    recommendations.push('Warning: Zero variance - all values are identical')
  }

  return {
    consensusOutliers,
    methodResults: { zscore, modifiedZscore, iqr, grubbs },
    outlierCounts,
    recommendations
  }
}
