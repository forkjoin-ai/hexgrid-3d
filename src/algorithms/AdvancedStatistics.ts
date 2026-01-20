export interface TrendResult {
  slope: number;
  direction: 'increasing' | 'decreasing' | 'stable';
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
  return values.reduce((sum, val) => {
    const ratio = val / avg;
    return sum + (ratio === 0 ? 0 : ratio * Math.log(ratio));
  }, 0) / values.length;
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

export function paretoRatio(values: number[], topFraction: number): {
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
    return { slope: 0, direction: 'stable' };
  }
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (values[i] - yMean);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
  return { slope, direction };
}

export function detectChangePoints(values: number[]): number[] {
  if (values.length < 3) return [];
  const changes: number[] = [];
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + (val - avg) ** 2, 0) / values.length;
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

export function exponentialMovingAverage(values: number[], alpha: number): number[] {
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

export function sparklineSvg(values: number[], width: number = 100, height: number = 20): string {
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
