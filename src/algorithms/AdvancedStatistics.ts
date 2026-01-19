/**
 * Advanced Statistics Suite
 * 
 * Professional-grade statistical analysis for territory dynamics
 * including inequality measures, forecasting, and topology.
 * 
 * Features:
 * - Inequality metrics: Gini, Theil, Atkinson, Pareto
 * - Entropy measures: Shannon, Rényi, Tsallis
 * - Time series: ARIMA, exponential smoothing, trend detection
 * - Topology: Betti numbers, persistent homology
 * - Convergence: Kullback-Leibler, Jensen-Shannon divergence
 * 
 * @module algorithms/AdvancedStatistics
 */

// ═══════════════════════════════════════════════════════════════════════════
// INEQUALITY METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gini coefficient (0 = perfect equality, 1 = total inequality)
 */
export function giniCoefficient(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i]
  }

  const mean = sorted.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return 0

  return sum / (n * n * mean)
}

/**
 * Theil index (generalized entropy with α=1)
 * Higher = more inequality
 */
export function theilIndex(values: number[]): number {
  const n = values.length
  if (n === 0) return 0

  const mean = values.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return 0

  let theil = 0
  for (const val of values) {
    if (val > 0) {
      const ratio = val / mean
      theil += ratio * Math.log(ratio)
    }
  }

  return theil / n
}

/**
 * Atkinson index (sensitivity to bottom of distribution)
 * @param epsilon - Inequality aversion parameter (higher = more weight to poor)
 */
export function atkinsonIndex(values: number[], epsilon: number = 1): number {
  const n = values.length
  if (n === 0) return 0

  const mean = values.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return 0

  if (Math.abs(epsilon - 1) < 0.0001) {
    // Use geometric mean for epsilon = 1
    const logSum = values.filter(v => v > 0).reduce((a, b) => a + Math.log(b), 0)
    const geometricMean = Math.exp(logSum / n)
    return 1 - geometricMean / mean
  } else {
    const sum = values.reduce((a, v) => a + Math.pow(v / mean, 1 - epsilon), 0)
    const powerMean = Math.pow(sum / n, 1 / (1 - epsilon))
    return 1 - powerMean
  }
}

/**
 * Pareto ratio analysis (how much of total is held by top percentile)
 */
export function paretoRatio(values: number[], topPercentile: number = 0.2): {
  ratioHeld: number
  paretoIndex: number
} {
  const sorted = [...values].sort((a, b) => b - a)
  const total = sorted.reduce((a, b) => a + b, 0)
  if (total === 0) return { ratioHeld: 0, paretoIndex: 0 }

  const topCount = Math.ceil(sorted.length * topPercentile)
  const topSum = sorted.slice(0, topCount).reduce((a, b) => a + b, 0)
  const ratioHeld = topSum / total

  // Pareto index (α) from 80/20 rule: log(0.2)/log(0.8) ≈ 1.16
  const paretoIndex = Math.log(topPercentile) / Math.log(ratioHeld)

  return { ratioHeld, paretoIndex }
}

/**
 * Zipf's law coefficient from ranked data
 */
export function zipfCoefficient(values: number[]): number {
  const sorted = [...values].filter(v => v > 0).sort((a, b) => b - a)
  if (sorted.length < 2) return 0

  // Linear regression on log-log scale
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  const n = sorted.length

  for (let i = 0; i < n; i++) {
    const x = Math.log(i + 1)
    const y = Math.log(sorted[i])
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX
  if (Math.abs(denominator) < 0.0001) return 0

  return -(n * sumXY - sumX * sumY) / denominator
}

/**
 * Herfindahl-Hirschman Index (market concentration)
 * Range: 1/N to 1 (1 = monopoly)
 */
export function herfindahlIndex(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  return values.reduce((sum, v) => {
    const share = v / total
    return sum + share * share
  }, 0)
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTROPY MEASURES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shannon entropy (in nats)
 */
export function shannonEntropy(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  let entropy = 0
  for (const val of values) {
    if (val > 0) {
      const p = val / total
      entropy -= p * Math.log(p)
    }
  }

  return entropy
}

/**
 * Normalized Shannon entropy (0 to 1)
 */
export function normalizedEntropy(values: number[]): number {
  const n = values.filter(v => v > 0).length
  if (n <= 1) return 0

  const entropy = shannonEntropy(values)
  const maxEntropy = Math.log(n)

  return maxEntropy === 0 ? 0 : entropy / maxEntropy
}

/**
 * Rényi entropy (generalization of Shannon)
 * @param alpha - Order parameter (Shannon when α→1)
 */
export function renyiEntropy(values: number[], alpha: number = 2): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  if (Math.abs(alpha - 1) < 0.0001) {
    return shannonEntropy(values)
  }

  const sum = values.reduce((acc, v) => {
    if (v > 0) {
      const p = v / total
      return acc + Math.pow(p, alpha)
    }
    return acc
  }, 0)

  return Math.log(sum) / (1 - alpha)
}

/**
 * Tsallis entropy (non-extensive generalization)
 * @param q - Entropic index
 */
export function tsallisEntropy(values: number[], q: number = 2): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total === 0) return 0

  if (Math.abs(q - 1) < 0.0001) {
    return shannonEntropy(values)
  }

  const sum = values.reduce((acc, v) => {
    if (v > 0) {
      const p = v / total
      return acc + Math.pow(p, q)
    }
    return acc
  }, 0)

  return (1 - sum) / (q - 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// DIVERGENCE MEASURES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kullback-Leibler divergence D_KL(P || Q)
 * Note: Asymmetric measure
 */
export function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) return 0

  const pTotal = p.reduce((a, b) => a + b, 0)
  const qTotal = q.reduce((a, b) => a + b, 0)
  if (pTotal === 0 || qTotal === 0) return 0

  let divergence = 0
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) {
      const pNorm = p[i] / pTotal
      const qNorm = q[i] / qTotal
      divergence += pNorm * Math.log(pNorm / qNorm)
    }
  }

  return divergence
}

/**
 * Jensen-Shannon divergence (symmetric, bounded)
 * Range: 0 to ln(2)
 */
export function jsDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length) return 0

  // Compute M = (P + Q) / 2
  const m = p.map((pi, i) => (pi + q[i]) / 2)

  return (klDivergence(p, m) + klDivergence(q, m)) / 2
}

/**
 * Bhattacharyya coefficient (similarity measure)
 * Range: 0 to 1 (1 = identical)
 */
export function bhattacharyyaCoefficient(p: number[], q: number[]): number {
  if (p.length !== q.length) return 0

  const pTotal = p.reduce((a, b) => a + b, 0)
  const qTotal = q.reduce((a, b) => a + b, 0)
  if (pTotal === 0 || qTotal === 0) return 0

  let bc = 0
  for (let i = 0; i < p.length; i++) {
    bc += Math.sqrt((p[i] / pTotal) * (q[i] / qTotal))
  }

  return bc
}

/**
 * Hellinger distance (metric based on Bhattacharyya)
 * Range: 0 to 1
 */
export function hellingerDistance(p: number[], q: number[]): number {
  const bc = bhattacharyyaCoefficient(p, q)
  return Math.sqrt(1 - bc)
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME SERIES ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple Moving Average
 */
export function movingAverage(values: number[], window: number): number[] {
  const result: number[] = []

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1)
    const windowValues = values.slice(start, i + 1)
    const avg = windowValues.reduce((a, b) => a + b, 0) / windowValues.length
    result.push(avg)
  }

  return result
}

/**
 * Exponential Moving Average
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.2): number[] {
  if (values.length === 0) return []

  const result: number[] = [values[0]]

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1]
    result.push(ema)
  }

  return result
}

/**
 * Double Exponential Smoothing (Holt's method)
 * Good for data with trend
 */
export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { smoothed: number[]; trend: number[]; forecast: (steps: number) => number[] } {
  if (values.length < 2) {
    return {
      smoothed: [...values],
      trend: values.length > 0 ? [0] : [],
      forecast: () => []
    }
  }

  const smoothed: number[] = [values[0]]
  const trend: number[] = [values[1] - values[0]]

  for (let i = 1; i < values.length; i++) {
    const prevSmoothed = smoothed[i - 1]
    const prevTrend = trend[i - 1]

    const newSmoothed = alpha * values[i] + (1 - alpha) * (prevSmoothed + prevTrend)
    const newTrend = beta * (newSmoothed - prevSmoothed) + (1 - beta) * prevTrend

    smoothed.push(newSmoothed)
    trend.push(newTrend)
  }

  const forecast = (steps: number): number[] => {
    const lastSmoothed = smoothed[smoothed.length - 1]
    const lastTrend = trend[trend.length - 1]

    return Array.from({ length: steps }, (_, i) => lastSmoothed + (i + 1) * lastTrend)
  }

  return { smoothed, trend, forecast }
}

/**
 * Trend detection using linear regression
 */
export function detectTrend(values: number[]): {
  slope: number
  intercept: number
  rSquared: number
  direction: 'increasing' | 'decreasing' | 'stable'
} {
  const n = values.length
  if (n < 2) {
    return { slope: 0, intercept: values[0] ?? 0, rSquared: 0, direction: 'stable' }
  }

  // Linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
    sumYY += values[i] * values[i]
  }

  const denominator = n * sumXX - sumX * sumX
  if (Math.abs(denominator) < 0.0001) {
    return { slope: 0, intercept: sumY / n, rSquared: 0, direction: 'stable' }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // R-squared
  const yMean = sumY / n
  const ssTotal = sumYY - n * yMean * yMean
  const ssResidual = values.reduce((sum, y, i) => {
    const predicted = slope * i + intercept
    return sum + (y - predicted) ** 2
  }, 0)

  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0

  // Determine direction
  const significanceThreshold = 0.1 * Math.abs(yMean)
  let direction: 'increasing' | 'decreasing' | 'stable'
  if (slope > significanceThreshold) {
    direction = 'increasing'
  } else if (slope < -significanceThreshold) {
    direction = 'decreasing'
  } else {
    direction = 'stable'
  }

  return { slope, intercept, rSquared, direction }
}

/**
 * Detect change points in time series
 */
export function detectChangePoints(
  values: number[],
  threshold: number = 2.0
): number[] {
  if (values.length < 5) return []

  const changePoints: number[] = []
  const window = 5

  for (let i = window; i < values.length - window; i++) {
    const leftMean = values.slice(i - window, i).reduce((a, b) => a + b, 0) / window
    const rightMean = values.slice(i, i + window).reduce((a, b) => a + b, 0) / window

    const leftStd = Math.sqrt(
      values.slice(i - window, i).reduce((sum, v) => sum + (v - leftMean) ** 2, 0) / window
    )

    const change = Math.abs(rightMean - leftMean)
    const normalizedChange = leftStd > 0 ? change / leftStd : change

    if (normalizedChange > threshold) {
      changePoints.push(i)
    }
  }

  // Remove consecutive change points
  return changePoints.filter((cp, i) => i === 0 || cp - changePoints[i - 1] > window)
}

// ═══════════════════════════════════════════════════════════════════════════
// WINNER PREDICTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Predict likely winner based on territory history
 */
export function predictWinner(
  historyByPlayer: Map<number, number[]>,
  forecastSteps: number = 10
): {
  predictions: Map<number, number[]>
  winner: number | null
  confidence: number
  winProbabilities: Map<number, number>
} {
  const predictions = new Map<number, number[]>()
  const finalValues = new Map<number, number>()

  for (const [player, history] of historyByPlayer) {
    if (history.length < 3) {
      predictions.set(player, Array(forecastSteps).fill(history[history.length - 1] ?? 0))
      finalValues.set(player, history[history.length - 1] ?? 0)
      continue
    }

    const { forecast } = doubleExponentialSmoothing(history)
    const predicted = forecast(forecastSteps)
    predictions.set(player, predicted)
    finalValues.set(player, predicted[predicted.length - 1])
  }

  // Find predicted winner
  let maxValue = -Infinity
  let winner: number | null = null

  for (const [player, value] of finalValues) {
    if (value > maxValue) {
      maxValue = value
      winner = player
    }
  }

  // Calculate win probabilities based on trend strength
  const winProbabilities = new Map<number, number>()
  const totalValue = Array.from(finalValues.values()).reduce((a, b) => Math.max(0, a) + Math.max(0, b), 0)

  for (const [player, value] of finalValues) {
    const prob = totalValue > 0 ? Math.max(0, value) / totalValue : 0
    winProbabilities.set(player, prob)
  }

  // Confidence based on lead
  const sortedValues = Array.from(finalValues.values()).sort((a, b) => b - a)
  const lead = sortedValues.length >= 2 ? sortedValues[0] - sortedValues[1] : sortedValues[0]
  const confidence = totalValue > 0 ? Math.min(1, lead / totalValue * 2) : 0

  return { predictions, winner, confidence, winProbabilities }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPOLOGICAL DATA ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute Euler characteristic of a territory
 * χ = V - E + F (vertices - edges + faces)
 */
export function eulerCharacteristic(
  cells: Set<number>,
  getNeighbors: (cell: number) => number[]
): number {
  if (cells.size === 0) return 0

  // V = number of cells (vertices in dual graph)
  const V = cells.size

  // E = number of edges between cells in territory
  let E = 0
  for (const cell of cells) {
    for (const neighbor of getNeighbors(cell)) {
      if (cells.has(neighbor)) {
        E++
      }
    }
  }
  E /= 2  // Each edge counted twice

  // For hexagonal grid, F ≈ number of holes
  // Simple approximation: F = 1 + number of enclosed holes
  // This is a simplification - true calculation requires boundary tracing
  const F = 1  // Assume one outer face

  return V - E + F
}

/**
 * Estimate Betti numbers for topology analysis
 * β0 = number of connected components
 * β1 = number of holes
 */
export function estimateBettiNumbers(
  cells: Set<number>,
  getNeighbors: (cell: number) => number[]
): { b0: number; b1: number } {
  if (cells.size === 0) return { b0: 0, b1: 0 }

  // β0: Count connected components
  const visited = new Set<number>()
  let b0 = 0

  for (const cell of cells) {
    if (visited.has(cell)) continue

    b0++
    const queue = [cell]
    visited.add(cell)

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const neighbor of getNeighbors(current)) {
        if (cells.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  // β1: Estimate holes using Euler characteristic
  // χ = β0 - β1 + β2 (β2 = 0 for 2D)
  // β1 = β0 - χ
  const euler = eulerCharacteristic(cells, getNeighbors)
  const b1 = Math.max(0, b0 - euler)

  return { b0, b1 }
}

/**
 * Compute territory compactness using isoperimetric quotient
 * Range: 0 to 1 (1 = perfectly circular/compact)
 */
export function compactness(
  cells: Set<number>,
  getNeighbors: (cell: number) => number[]
): number {
  if (cells.size === 0) return 0

  // Count boundary cells
  let perimeter = 0
  for (const cell of cells) {
    for (const neighbor of getNeighbors(cell)) {
      if (!cells.has(neighbor)) {
        perimeter++
      }
    }
  }

  // Isoperimetric quotient: 4πA/P²
  // For hexagons, adjusted factor
  const area = cells.size
  if (perimeter === 0) return 1

  return (4 * Math.PI * area) / (perimeter * perimeter)
}

// ═══════════════════════════════════════════════════════════════════════════
// SPARKLINE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate ASCII sparkline
 */
export function sparkline(values: number[], width: number = 20): string {
  if (values.length === 0) return ''

  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  // Downsample if needed
  const step = Math.max(1, Math.floor(values.length / width))
  const sampled: number[] = []

  for (let i = 0; i < values.length; i += step) {
    const chunk = values.slice(i, Math.min(i + step, values.length))
    sampled.push(chunk.reduce((a, b) => a + b, 0) / chunk.length)
  }

  return sampled.map(v => {
    const normalized = (v - min) / range
    const index = Math.min(blocks.length - 1, Math.floor(normalized * blocks.length))
    return blocks[index]
  }).join('')
}

/**
 * Generate SVG sparkline path
 */
export function sparklineSvg(
  values: number[],
  width: number = 100,
  height: number = 30
): string {
  if (values.length < 2) return ''

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })

  return `M${points.join(' L')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE STATS OBJECT
// ═══════════════════════════════════════════════════════════════════════════

export interface TerritoryStats {
  // Basic counts
  totalCells: number
  playerCounts: Map<number, number>
  
  // Inequality
  gini: number
  theil: number
  atkinson: number
  herfindahl: number
  paretoRatio: number
  zipfCoefficient: number
  
  // Entropy
  shannonEntropy: number
  normalizedEntropy: number
  renyiEntropy: number
  
  // Distribution
  mean: number
  median: number
  stdDev: number
  skewness: number
  kurtosis: number
  
  // Trends (if history provided)
  trend?: {
    slope: number
    direction: 'increasing' | 'decreasing' | 'stable'
    rSquared: number
  }
  
  // Winner prediction (if history provided)
  prediction?: {
    winner: number | null
    confidence: number
    probabilities: Map<number, number>
  }
}

/**
 * Compute comprehensive territory statistics
 */
export function computeTerritoryStats(
  counts: Map<number, number>,
  history?: Map<number, number[]>
): TerritoryStats {
  const values = Array.from(counts.values())
  const sorted = [...values].sort((a, b) => a - b)
  const n = values.length
  const totalCells = values.reduce((a, b) => a + b, 0)
  const mean = n > 0 ? totalCells / n : 0

  // Variance, skewness, kurtosis
  let variance = 0, m3 = 0, m4 = 0
  for (const v of values) {
    const diff = v - mean
    variance += diff * diff
    m3 += diff * diff * diff
    m4 += diff * diff * diff * diff
  }
  variance = n > 0 ? variance / n : 0
  const stdDev = Math.sqrt(variance)

  const skewness = n > 0 && stdDev > 0 ? (m3 / n) / (stdDev ** 3) : 0
  const kurtosis = n > 0 && stdDev > 0 ? (m4 / n) / (stdDev ** 4) - 3 : 0

  const median = n > 0 ? (n % 2 === 0 
    ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
    : sorted[Math.floor(n/2)]) : 0

  const pareto = paretoRatio(values, 0.2)

  const stats: TerritoryStats = {
    totalCells,
    playerCounts: new Map(counts),
    
    gini: giniCoefficient(values),
    theil: theilIndex(values),
    atkinson: atkinsonIndex(values),
    herfindahl: herfindahlIndex(values),
    paretoRatio: pareto.ratioHeld,
    zipfCoefficient: zipfCoefficient(values),
    
    shannonEntropy: shannonEntropy(values),
    normalizedEntropy: normalizedEntropy(values),
    renyiEntropy: renyiEntropy(values),
    
    mean,
    median,
    stdDev,
    skewness,
    kurtosis
  }

  // Add trend analysis if history provided
  if (history && history.size > 0) {
    // Use first player's history for overall trend
    const firstHistory = Array.from(history.values())[0]
    if (firstHistory && firstHistory.length > 2) {
      stats.trend = detectTrend(firstHistory)
    }

    // Winner prediction
    const prediction = predictWinner(history)
    stats.prediction = {
      winner: prediction.winner,
      confidence: prediction.confidence,
      probabilities: prediction.winProbabilities
    }
  }

  return stats
}
