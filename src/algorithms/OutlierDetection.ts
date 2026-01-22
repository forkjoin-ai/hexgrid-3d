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

export function detectVarianceChanges(
  values: number[]
): VarianceChangeResult[] {
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
    const ratio =
      beforeVar === 0 ? (afterVar === 0 ? 1 : Infinity) : afterVar / beforeVar;

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

// Game Anomaly Detection
export interface GameAnomaly {
  index: number;
  type: 'sudden_change' | 'pattern_break' | 'statistical_outlier';
  severity: number;
  description: string;
}

export function detectGameAnomalies(
  values: number[],
  windowSize: number = 5
): GameAnomaly[] {
  const anomalies: GameAnomaly[] = [];
  if (values.length < windowSize * 2) return anomalies;

  for (let i = windowSize; i < values.length - windowSize; i++) {
    const before = values.slice(i - windowSize, i);
    const after = values.slice(i, i + windowSize);
    const beforeMean = before.reduce((s, v) => s + v, 0) / before.length;
    const afterMean = after.reduce((s, v) => s + v, 0) / after.length;
    const change = Math.abs(afterMean - beforeMean);
    const threshold =
      before.reduce((s, v) => s + Math.abs(v - beforeMean), 0) / before.length;

    if (change > threshold * 2) {
      anomalies.push({
        index: i,
        type: 'sudden_change',
        severity: Math.min(1, change / (threshold || 1)),
        description: `Sudden change detected at index ${i}`,
      });
    }
  }

  return anomalies;
}

// Comprehensive Outlier Analysis
export interface MultivariateOutlierResult {
  outliers: number[];
  scores: number[];
  method: string;
}

export function comprehensiveOutlierAnalysis(
  values: number[]
): MultivariateOutlierResult {
  const zScore = detectOutliersZScore(values);
  const iqr = detectOutliersIQR(values);
  const combined = new Set([...zScore.outlierIndices, ...iqr.outlierIndices]);

  return {
    outliers: Array.from(combined),
    scores: values.map((v, i) =>
      combined.has(i)
        ? Math.max(
            Math.abs(zScore.scores[i] ?? 0),
            Math.abs(iqr.scores[i] ?? 0)
          )
        : 0
    ),
    method: 'comprehensive',
  };
}

// Local Outlier Factor (simplified)
export function localOutlierFactor(
  values: number[],
  k: number = 5
): OutlierResult {
  // Simplified LOF implementation
  if (values.length < k + 1) {
    return {
      outlierIndices: [],
      scores: values.map(() => 0),
      stats: { mean: 0, stdDev: 0 },
      threshold: 1.5,
    };
  }

  const scores: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const distances = values
      .map((v, j) => (i === j ? Infinity : Math.abs(v - values[i]!)))
      .sort((a, b) => a - b);
    const kthDistance = distances[k] ?? 0;
    const reachability = values.map((v, j) =>
      Math.max(kthDistance, Math.abs(v - values[i]!))
    );
    const lrd = k / reachability.reduce((s, r) => s + r, 0);
    scores.push(lrd);
  }

  const avgLrd = scores.reduce((s, lrd) => s + lrd, 0) / scores.length;
  const lofScores = scores.map((lrd) => (lrd === 0 ? 0 : avgLrd / lrd));
  const threshold = 1.5;
  const outlierIndices = lofScores
    .map((score, idx) => ({ score, idx }))
    .filter(({ score }) => score > threshold)
    .map(({ idx }) => idx);

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    outlierIndices,
    scores: lofScores,
    stats: { mean: avg, stdDev },
    threshold,
  };
}

// Isolation Forest (simplified)
export function isolationForest(
  values: number[],
  trees: number = 100,
  samples: number = 256
): OutlierResult {
  // Simplified isolation forest
  const scores: number[] = [];
  const sampleSize = Math.min(samples, values.length);

  for (let i = 0; i < values.length; i++) {
    let pathLengthSum = 0;
    for (let t = 0; t < trees; t++) {
      const sample = [];
      for (let s = 0; s < sampleSize; s++) {
        sample.push(values[Math.floor(Math.random() * values.length)] ?? 0);
      }
      const min = Math.min(...sample);
      const max = Math.max(...sample);
      const range = max - min || 1;
      const normalized = (values[i]! - min) / range;
      pathLengthSum += Math.log2(Math.max(1, normalized * sampleSize));
    }
    const avgPathLength = pathLengthSum / trees;
    const anomalyScore = Math.pow(2, -avgPathLength / Math.log2(sampleSize));
    scores.push(anomalyScore);
  }

  const threshold = 0.5;
  const outlierIndices = scores
    .map((score, idx) => ({ score, idx }))
    .filter(({ score }) => score > threshold)
    .map(({ idx }) => idx);

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    outlierIndices,
    scores,
    stats: { mean: avg, stdDev },
    threshold,
  };
}

// CUSUM Chart
export function cusumChart(
  values: number[],
  target: number,
  h: number = 5,
  k: number = 0.5
): TimeSeriesAnomaly[] {
  const anomalies: TimeSeriesAnomaly[] = [];
  let sPos = 0;
  let sNeg = 0;

  for (let i = 0; i < values.length; i++) {
    const deviation = values[i]! - target;
    sPos = Math.max(0, sPos + deviation - k);
    sNeg = Math.max(0, sNeg - deviation - k);

    if (sPos > h || sNeg > h) {
      anomalies.push({
        index: i,
        isAnomaly: true,
        zScore: Math.max(sPos, sNeg) / h,
        expectedValue: target,
        actualValue: values[i]!,
        confidence: Math.min(0.99, Math.max(sPos, sNeg) / (h * 2)),
        anomalyType: sPos > sNeg ? 'spike' : 'drop',
      });
    }
  }

  return anomalies;
}

// EWMA Chart (Exponentially Weighted Moving Average)
export function ewmaChart(
  values: number[],
  lambda: number = 0.2,
  lcl: number = -3,
  ucl: number = 3
): TimeSeriesAnomaly[] {
  const anomalies: TimeSeriesAnomaly[] = [];
  if (values.length === 0) return anomalies;

  let ewma = values[0]!;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const ewmaStdDev = stdDev * Math.sqrt(lambda / (2 - lambda));

  for (let i = 1; i < values.length; i++) {
    ewma = lambda * values[i]! + (1 - lambda) * ewma;
    const zScore = (ewma - mean) / (ewmaStdDev || 1);

    if (zScore < lcl || zScore > ucl) {
      anomalies.push({
        index: i,
        isAnomaly: true,
        zScore: Math.abs(zScore),
        expectedValue: mean,
        actualValue: values[i]!,
        confidence: Math.min(0.99, Math.abs(zScore) / 5),
        anomalyType: zScore > 0 ? 'spike' : 'drop',
      });
    }
  }

  return anomalies;
}
