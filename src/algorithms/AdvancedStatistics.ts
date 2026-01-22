export interface TrendResult {
  slope: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  rSquared?: number;
}

export function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  const n = sorted.length;
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += (i + 1) * sorted[i];
  }
  return (2 * cumulative) / (n * total) - (n + 1) / n;
}

export function theilIndex(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (avg === 0) return 0;
  return (
    values.reduce((sum, val) => {
      const ratio = val / avg;
      return sum + (ratio === 0 ? 0 : ratio * Math.log(ratio));
    }, 0) / values.length
  );
}

export function atkinsonIndex(values: number[], epsilon: number): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (avg === 0) return 0;
  if (epsilon === 1) {
    const geomMean = Math.exp(
      values.reduce((sum, val) => sum + Math.log(Math.max(val, 1e-9)), 0) /
        values.length
    );
    return 1 - geomMean / avg;
  }
  const meanPower =
    values.reduce((sum, val) => sum + Math.pow(val, 1 - epsilon), 0) /
    values.length;
  const eq = Math.pow(meanPower, 1 / (1 - epsilon));
  return 1 - eq / avg;
}

export function paretoRatio(
  values: number[],
  topFraction: number
): {
  ratioHeld: number;
  paretoIndex: number;
} {
  if (values.length === 0) return { ratioHeld: 0, paretoIndex: 0 };
  const sorted = [...values].sort((a, b) => b - a);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  if (total === 0) return { ratioHeld: 0, paretoIndex: 0 };
  const topCount = Math.max(1, Math.floor(values.length * topFraction));
  const topSum = sorted.slice(0, topCount).reduce((sum, val) => sum + val, 0);
  return { ratioHeld: topSum / total, paretoIndex: topFraction };
}

export function zipfCoefficient(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const total = sorted.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  return sorted.reduce((sum, val, idx) => sum + val / (idx + 1), 0) / total;
}

export function herfindahlIndex(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  return values.reduce((sum, val) => {
    const share = val / total;
    return sum + share * share;
  }, 0);
}

export function shannonEntropy(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  return values.reduce((sum, val) => {
    const p = val / total;
    return p === 0 ? sum : sum - p * Math.log2(p);
  }, 0);
}

export function normalizedEntropy(values: number[]): number {
  if (values.length === 0) return 0;
  const entropy = shannonEntropy(values);
  const maxEntropy = Math.log2(values.length || 1);
  return maxEntropy === 0 ? 0 : entropy / maxEntropy;
}

export function renyiEntropy(values: number[], alpha: number): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  const sum = values.reduce((acc, val) => {
    const p = val / total;
    return acc + Math.pow(p, alpha);
  }, 0);
  return (1 / (1 - alpha)) * Math.log2(sum || 1);
}

export function tsallisEntropy(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, val) => sum + val, 0);
  if (total === 0) return 0;
  const sum = values.reduce((acc, val) => {
    const p = val / total;
    return acc + Math.pow(p, q);
  }, 0);
  return (1 - sum) / (q - 1);
}

export function detectTrend(values: number[]): TrendResult {
  if (values.length < 2) {
    return { slope: 0, direction: 'stable', rSquared: 0 };
  }
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  let num = 0;
  let den = 0;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += Math.pow(values[i] - predicted, 2);
    ssTot += Math.pow(values[i] - yMean, 2);
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const direction =
    slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
  return { slope, direction, rSquared };
}

export function detectChangePoints(values: number[]): number[] {
  if (values.length < 3) return [];
  const changes: number[] = [];
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length;
  const threshold = Math.sqrt(variance) * 1.5;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i] - values[i - 1]) > threshold) {
      changes.push(i);
    }
  }
  return changes;
}

export function movingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(avg);
  }
  return result;
}

export function exponentialMovingAverage(
  values: number[],
  alpha: number
): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  let current = values[0] ?? 0;
  result.push(current);
  for (let i = 1; i < values.length; i++) {
    current = alpha * values[i] + (1 - alpha) * current;
    result.push(current);
  }
  return result;
}

export function predictWinner(values: number[]): number {
  if (values.length === 0) return 0;
  const max = Math.max(...values);
  return values.indexOf(max);
}

export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const ticks = '▁▂▃▄▅▆▇█';
  return values
    .map((value) => {
      const idx = Math.round(((value - min) / range) * (ticks.length - 1));
      return ticks[idx] ?? ticks[0];
    })
    .join('');
}

export function sparklineSvg(
  values: number[],
  width: number = 100,
  height: number = 20
): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

// KL Divergence (Kullback-Leibler)
export function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length || p.length === 0) return 0;
  return p.reduce((sum, pi, i) => {
    if (pi === 0) return sum;
    const qi = q[i] ?? 1e-10;
    return sum + pi * Math.log2(pi / qi);
  }, 0);
}

// JS Divergence (Jensen-Shannon)
export function jsDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length || p.length === 0) return 0;
  const m = p.map((pi, i) => (pi + (q[i] ?? 0)) / 2);
  return (klDivergence(p, m) + klDivergence(q, m)) / 2;
}

// Bhattacharyya Coefficient
export function bhattacharyyaCoefficient(p: number[], q: number[]): number {
  if (p.length !== q.length || p.length === 0) return 0;
  return p.reduce((sum, pi, i) => {
    const qi = q[i] ?? 0;
    return sum + Math.sqrt(pi * qi);
  }, 0);
}

// Hellinger Distance
export function hellingerDistance(p: number[], q: number[]): number {
  if (p.length !== q.length || p.length === 0) return 0;
  const bc = bhattacharyyaCoefficient(p, q);
  return Math.sqrt(1 - bc);
}

// Double Exponential Smoothing (Holt's method)
export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): number[] {
  if (values.length === 0) return [];
  const result: number[] = [];
  let level = values[0] ?? 0;
  let trend = 0;

  result.push(level);

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    result.push(level + trend);
  }

  return result;
}

// Euler Characteristic (simplified for 2D)
export function eulerCharacteristic(
  vertices: number,
  edges: number,
  faces: number
): number {
  return vertices - edges + faces;
}

// Estimate Betti Numbers (simplified - returns basic topological invariants)
export function estimateBettiNumbers(complex: {
  vertices: number;
  edges: number;
  faces: number;
}): { b0: number; b1: number } {
  const euler = eulerCharacteristic(
    complex.vertices,
    complex.edges,
    complex.faces
  );
  // Simplified: b0 = number of connected components (assume 1 for now)
  // b1 = edges - vertices + 1 (for a connected graph)
  const b0 = 1;
  const b1 = Math.max(0, complex.edges - complex.vertices + 1);
  return { b0, b1 };
}

// Compactness measure
export function compactness(area: number, perimeter: number): number {
  if (perimeter === 0) return 0;
  // 4π * area / perimeter^2 (circularity measure)
  return (4 * Math.PI * area) / (perimeter * perimeter);
}

// Territory Statistics
export interface TerritoryStats {
  totalTerritories: number;
  averageSize: number;
  largestTerritory: number;
  smallestTerritory: number;
  compactness: number;
}

export function computeTerritoryStats(
  territories: Array<{ area: number; perimeter: number }>
): TerritoryStats {
  if (territories.length === 0) {
    return {
      totalTerritories: 0,
      averageSize: 0,
      largestTerritory: 0,
      smallestTerritory: 0,
      compactness: 0,
    };
  }

  const sizes = territories.map((t) => t.area);
  const totalSize = sizes.reduce((sum, s) => sum + s, 0);
  const avgCompactness =
    territories.reduce((sum, t) => sum + compactness(t.area, t.perimeter), 0) /
    territories.length;

  return {
    totalTerritories: territories.length,
    averageSize: totalSize / territories.length,
    largestTerritory: Math.max(...sizes),
    smallestTerritory: Math.min(...sizes),
    compactness: avgCompactness,
  };
}
