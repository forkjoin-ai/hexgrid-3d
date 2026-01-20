export interface OutlierStats {
  mean: number;
  stdDev: number;
}

export interface OutlierResult {
  outlierIndices: number[];
  scores: number[];
  stats: OutlierStats;
  threshold: number;
}

export interface TimeSeriesAnomaly {
  index: number;
  isAnomaly: boolean;
  zScore: number;
  expectedValue: number;
  actualValue: number;
  confidence: number;
  anomalyType: 'spike' | 'drop' | 'change';
}

export interface VarianceChangeResult {
  index: number;
  ratio: number;
  beforeVariance: number;
  afterVariance: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function detectOutliersZScore(
  values: number[],
  threshold: number = 3
): OutlierResult {
  const avg = mean(values);
  const deviation = stdDev(values, avg);
  const scores = values.map((value) =>
    deviation === 0 ? 0 : (value - avg) / deviation
  );

  const outlierIndices = scores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => Math.abs(score) >= threshold)
    .map(({ index }) => index);

  return {
    outlierIndices,
    scores,
    stats: { mean: avg, stdDev: deviation },
    threshold,
  };
}

export function detectOutliersModifiedZScore(
  values: number[],
  threshold: number = 3.5
): OutlierResult {
  if (values.length === 0) {
    return {
      outlierIndices: [],
      scores: [],
      stats: { mean: 0, stdDev: 0 },
      threshold,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const deviations = values.map((value) => Math.abs(value - median));
  const sortedDeviations = [...deviations].sort((a, b) => a - b);
  const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)] || 0;

  const scores = values.map((value) =>
    mad === 0 ? 0 : (0.6745 * (value - median)) / mad
  );

  const outlierIndices = scores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => Math.abs(score) >= threshold)
    .map(({ index }) => index);

  return {
    outlierIndices,
    scores,
    stats: { mean: median, stdDev: mad },
    threshold,
  };
}

export function detectOutliersIQR(
  values: number[],
  threshold: number = 1.5
): OutlierResult {
  if (values.length === 0) {
    return {
      outlierIndices: [],
      scores: [],
      stats: { mean: 0, stdDev: 0 },
      threshold,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;

  const lowerBound = q1 - threshold * iqr;
  const upperBound = q3 + threshold * iqr;

  const outlierIndices = values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value < lowerBound || value > upperBound)
    .map(({ index }) => index);

  const avg = mean(values);
  const deviation = stdDev(values, avg);
  const scores = values.map((value) =>
    deviation === 0 ? 0 : (value - avg) / deviation
  );

  return {
    outlierIndices,
    scores,
    stats: { mean: avg, stdDev: deviation },
    threshold,
  };
}

export function detectGrowthSpikes(values: number[]): TimeSeriesAnomaly[] {
  if (values.length < 2) return [];

  const diffs = values.slice(1).map((value, index) => value - values[index]);
  const diffStats = detectOutliersZScore(diffs, 2.5);

  return diffs.map((diff, index) => {
    const score = diffStats.scores[index] ?? 0;
    const isAnomaly = Math.abs(score) >= 2.5;
    return {
      index: index + 1,
      isAnomaly,
      zScore: Math.abs(score),
      expectedValue: values[index],
      actualValue: values[index + 1],
      confidence: Math.min(0.99, Math.abs(score) / 4),
      anomalyType: diff >= 0 ? 'spike' : 'drop',
    };
  });
}

export function detectVarianceChanges(values: number[]): VarianceChangeResult[] {
  if (values.length < 6) return [];
  const results: VarianceChangeResult[] = [];
  const windowSize = Math.max(3, Math.floor(values.length / 4));

  for (let i = windowSize; i < values.length - windowSize; i++) {
    const before = values.slice(i - windowSize, i);
    const after = values.slice(i, i + windowSize);
    const beforeMean = mean(before);
    const afterMean = mean(after);
    const beforeVar = stdDev(before, beforeMean) ** 2;
    const afterVar = stdDev(after, afterMean) ** 2;
    const ratio = beforeVar === 0 ? (afterVar === 0 ? 1 : Infinity) : afterVar / beforeVar;

    results.push({
      index: i,
      ratio,
      beforeVariance: beforeVar,
      afterVariance: afterVar,
    });
  }

  return results;
}

export function mahalanobisOutliers(
  values: number[],
  threshold: number = 3
): OutlierResult {
  return detectOutliersZScore(values, threshold);
}
