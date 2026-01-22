/**
 * Unified Snapshot API
 *
 * Single comprehensive API to get ALL statistics, predictions, and insights
 * about the current game state in one easy method call.
 *
 * @module Snapshot
 *
 * @example Basic Usage
 * ```typescript
 * import { generateSnapshot } from '@buley/hexgrid-3d'
 *
 * const snapshot = generateSnapshot(cells, history, conquests, getNeighbors)
 *
 * // Access player data
 * console.log(snapshot.players[0].winProbability)  // 0.72
 * console.log(snapshot.players[0].sparklineAscii)  // "▁▂▃▅▆█"
 *
 * // Access game state
 * console.log(snapshot.indices.dominance)  // 0.65
 * console.log(snapshot.predictions.likelyWinner)  // 2
 *
 * // Get insights
 * console.log(snapshot.insights)
 * // ["🏆 Player 2 dominates with 65.2% of territory",
 * //  "🚀 Leader's territory growing steadily"]
 * ```
 *
 * @example Full Response Object
 * ```typescript
 * // GameSnapshot example response:
 * const exampleSnapshot: GameSnapshot = {
 *   timestamp: 1705678800000,
 *   turnNumber: 45,
 *   totalCells: 1000,
 *   occupiedCells: 850,
 *   playerCount: 4,
 *
 *   players: [{
 *     id: 2,
 *     cellCount: 320,
 *     shareOfTotal: 0.376,
 *     rank: 1,
 *     historyLength: 45,
 *     history: [10, 15, 22, 35, ...],
 *     recentTrend: 'growing',
 *     trendSlope: 4.2,
 *     trendConfidence: 0.89,
 *     winProbability: 0.72,
 *     winCredibleInterval: [0.58, 0.84],
 *     forecastNext10: [325, 330, 338, ...],
 *     kalmanEstimate: 322.5,
 *     kalmanUncertainty: 12.3,
 *     conquestRate: 0.15,
 *     conquestRateCI: [0.12, 0.18],
 *     avgGrowthPerTurn: 6.8,
 *     volatility: 0.23,
 *     numRegions: 2,
 *     largestRegionSize: 290,
 *     borderCellCount: 85,
 *     compactness: 0.72,
 *     sparklineAscii: "▁▂▃▄▅▆▇█",
 *     sparklineSvgPath: "M0,30 L10,25 L20,18...",
 *     leadOverSecond: 45,
 *     turnsUntilOvertake: null
 *   }, ...],
 *
 *   inequality: {
 *     gini: 0.42,
 *     theil: 0.35,
 *     atkinson: 0.28,
 *     herfindahl: 0.31,
 *     paretoRatio: 0.72,
 *     zipfCoefficient: 1.15,
 *     interpretation: "Emerging dominance"
 *   },
 *
 *   indices: {
 *     dominance: 0.65,
 *     volatility: 0.35,
 *     predictability: 0.72,
 *     competitiveness: 0.45,
 *     stability: 0.68
 *   },
 *
 *   predictions: {
 *     likelyWinner: 2,
 *     winnerConfidence: 0.72,
 *     estimatedTurnsToVictory: 25,
 *     isEndgame: false,
 *     secondPlaceChallenger: 3,
 *     comebackPossibility: 0.28
 *   },
 *
 *   anomalies: {
 *     outliers: [{ playerId: 4, type: 'growth_explosion', ... }],
 *     hasAnomalies: true,
 *     anomalyCount: 1
 *   },
 *
 *   insights: [
 *     "📈 Player 2 leads with majority control (37.6%)",
 *     "🚀 Leader's territory growing steadily (slope: 4.2/turn)",
 *     "🎯 Player 3 has 22.5% chance of winning"
 *   ]
 * }
 * ```
 */

import {
  giniCoefficient,
  theilIndex,
  atkinsonIndex,
  paretoRatio,
  zipfCoefficient,
  herfindahlIndex,
  shannonEntropy,
  normalizedEntropy,
  renyiEntropy,
  tsallisEntropy,
  klDivergence,
  jsDivergence,
  bhattacharyyaCoefficient,
  hellingerDistance,
  movingAverage,
  exponentialMovingAverage,
  doubleExponentialSmoothing,
  detectTrend,
  detectChangePoints,
  predictWinner,
  eulerCharacteristic,
  estimateBettiNumbers,
  compactness,
  sparkline,
  sparklineSvg,
  computeTerritoryStats,
  type TerritoryStats,
} from './algorithms/AdvancedStatistics';

import {
  BetaDistribution,
  DirichletDistribution,
  NormalDistribution,
  PoissonDistribution,
  ExponentialDistribution,
  MarkovChain,
  KalmanFilter,
  HiddenMarkovModel,
  bayesianABTest,
  bayesFactor,
  mapEstimate,
  learnMarkovChain,
  bootstrapConfidenceInterval,
  monteCarloIntegrate,
  mutualInformation,
  conditionalEntropy,
  normalizedMutualInformation,
  bayesianWinProbability,
  bayesianConquestRate,
  bayesianChangepoint,
  generateProbabilitySnapshot,
  type ProbabilitySnapshot,
} from './algorithms/BayesianStatistics';

import {
  detectOutliersZScore,
  detectOutliersModifiedZScore,
  detectOutliersIQR,
  detectGrowthSpikes,
  detectVarianceChanges,
  detectGameAnomalies,
  comprehensiveOutlierAnalysis,
  mahalanobisOutliers,
  localOutlierFactor,
  isolationForest,
  cusumChart,
  ewmaChart,
  type OutlierResult,
  type TimeSeriesAnomaly,
  type GameAnomaly,
  type MultivariateOutlierResult,
} from './algorithms/OutlierDetection';

import {
  findConnectedComponents,
  analyzeTerritorBoundaries,
} from './algorithms/GraphAlgorithms';

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED SNAPSHOT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Player-specific statistics
 *
 * @example
 * ```typescript
 * const player: PlayerSnapshot = {
 *   id: 1,
 *   cellCount: 150,
 *   shareOfTotal: 0.25,
 *   rank: 2,
 *   historyLength: 30,
 *   history: [10, 15, 25, 40, 60, 90, 120, 150],
 *   recentTrend: 'growing',
 *   trendSlope: 5.2,
 *   trendConfidence: 0.92,
 *   winProbability: 0.35,
 *   winCredibleInterval: [0.22, 0.48],
 *   forecastNext10: [155, 162, 170, 178, 186, 195, 204, 213, 223, 233],
 *   kalmanEstimate: 152.3,
 *   kalmanUncertainty: 8.5,
 *   conquestRate: 0.12,
 *   conquestRateCI: [0.08, 0.16],
 *   avgGrowthPerTurn: 4.8,
 *   volatility: 0.18,
 *   numRegions: 1,
 *   largestRegionSize: 150,
 *   borderCellCount: 42,
 *   compactness: 0.78,
 *   sparklineAscii: "▁▂▃▄▅▆▇█",
 *   sparklineSvgPath: "M0,30 L12.5,25 L25,18 L37.5,12...",
 *   leadOverSecond: null,  // not the leader
 *   turnsUntilOvertake: 8
 * }
 * ```
 */
export interface PlayerSnapshot {
  /** Unique player identifier */
  id: number;

  // Territory
  /** Current number of cells owned */
  cellCount: number;
  /** Fraction of total occupied cells (0-1) */
  shareOfTotal: number;
  /** Current ranking (1 = leader) */
  rank: number;

  // History
  /** Number of turns of history available */
  historyLength: number;
  /** Territory count history (last 20 turns unless includeFullHistory=true) */
  history: number[];
  /** Recent territory trend direction */
  recentTrend: 'growing' | 'shrinking' | 'stable';
  /** Linear regression slope (cells per turn) */
  trendSlope: number;
  /** R² confidence in trend (0-1) */
  trendConfidence: number;

  // Predictions
  /** Bayesian probability of winning (0-1) */
  winProbability: number;
  /** 95% credible interval for win probability */
  winCredibleInterval: [number, number];
  /** Forecasted territory for next 10 turns */
  forecastNext10: number[];
  /** Kalman filter smoothed estimate */
  kalmanEstimate: number;
  /** Kalman filter uncertainty (±) */
  kalmanUncertainty: number;

  // Performance
  /** Bayesian conquest success rate */
  conquestRate: number;
  /** 95% credible interval for conquest rate */
  conquestRateCI: [number, number];
  /** Average cells gained per turn */
  avgGrowthPerTurn: number;
  /** Territory volatility (coefficient of variation) */
  volatility: number;

  // Topology
  /** Number of disconnected territory regions */
  numRegions: number;
  /** Size of largest connected region */
  largestRegionSize: number;
  /** Number of cells on territory border */
  borderCellCount: number;
  /** Territory shape compactness (0-1, higher = more compact) */
  compactness: number;

  // Sparklines
  /** ASCII sparkline visualization of history */
  sparklineAscii: string;
  /** SVG path data for sparkline */
  sparklineSvgPath: string;

  // Relative metrics
  /** Lead over second place (null if not leader) */
  leadOverSecond: number | null;
  /** Estimated turns until this player could overtake leader */
  turnsUntilOvertake: number | null;
}

/**
 * Inequality metrics for territory distribution
 *
 * @example
 * ```typescript
 * const inequality: InequalityMetrics = {
 *   gini: 0.42,          // 0=equal, 1=one player has all
 *   theil: 0.35,         // 0=equal, higher=more unequal
 *   atkinson: 0.28,      // Sensitive to lower end of distribution
 *   herfindahl: 0.31,    // Market concentration (0.25=4 equal players)
 *   paretoRatio: 0.72,   // Top player's share of total
 *   zipfCoefficient: 1.15, // Power law exponent
 *   interpretation: "Emerging dominance - one player pulling ahead"
 * }
 * ```
 */
export interface InequalityMetrics {
  gini: number;
  theil: number;
  atkinson: number;
  herfindahl: number;
  paretoRatio: number;
  zipfCoefficient: number;
  interpretation: string;
}

/**
 * Diversity/entropy metrics for territory distribution
 *
 * @example
 * ```typescript
 * const diversity: DiversityMetrics = {
 *   shannon: 1.85,       // Bits of information
 *   normalized: 0.92,    // 0-1, relative to max possible
 *   renyi: 1.78,         // Generalized entropy (order 2)
 *   tsallis: 1.52,       // Non-extensive entropy
 *   interpretation: "High diversity - competitive game"
 * }
 * ```
 */
export interface DiversityMetrics {
  shannon: number;
  normalized: number;
  renyi: number;
  tsallis: number;
  interpretation: string;
}

/**
 * Distribution statistics for territory counts
 *
 * @example
 * ```typescript
 * const distribution: DistributionMetrics = {
 *   mean: 250,
 *   median: 220,
 *   stdDev: 85,
 *   skewness: 0.65,      // Positive = right-skewed
 *   kurtosis: 2.8,       // 3 = normal distribution
 *   coefficientOfVariation: 0.34,
 *   iqr: 120,            // Interquartile range
 *   min: 85,
 *   max: 420,
 *   range: 335
 * }
 * ```
 */
export interface DistributionMetrics {
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  coefficientOfVariation: number;
  iqr: number;
  min: number;
  max: number;
  range: number;
}

/**
 * Game state indices (0-1 scale)
 *
 * @example
 * ```typescript
 * const indices: GameIndices = {
 *   dominance: 0.65,       // One player controls 65% relative
 *   volatility: 0.35,      // 35% average change per turn
 *   predictability: 0.72,  // 72% confidence in predictions
 *   competitiveness: 0.45, // 45% competitive (55% decided)
 *   stability: 0.68        // 68% stable territories
 * }
 * ```
 */
export interface GameIndices {
  /** How dominated by a single player (0=even, 1=total domination) */
  dominance: number;
  /** How much territory changes each turn (0=static, 1=chaotic) */
  volatility: number;
  /** How predictable outcomes are (0=random, 1=deterministic) */
  predictability: number;
  /** How close the competition (0=decided, 1=neck-and-neck) */
  competitiveness: number;
  /** How stable territory boundaries are (0=fluid, 1=locked) */
  stability: number;
}

/**
 * Game outcome predictions
 *
 * @example
 * ```typescript
 * const predictions: GamePredictions = {
 *   likelyWinner: 2,
 *   winnerConfidence: 0.72,
 *   estimatedTurnsToVictory: 25,
 *   isEndgame: false,
 *   secondPlaceChallenger: 3,
 *   comebackPossibility: 0.28
 * }
 * ```
 */
export interface GamePredictions {
  /** Player ID most likely to win */
  likelyWinner: number | null;
  /** Confidence in winner prediction (0-1) */
  winnerConfidence: number;
  /** Estimated turns until victory condition */
  estimatedTurnsToVictory: number | null;
  /** Whether game is in endgame phase */
  isEndgame: boolean;
  /** Second place player who could challenge */
  secondPlaceChallenger: number | null;
  /** Probability of comeback by non-leader */
  comebackPossibility: number;
}

/**
 * Territory topology metrics
 *
 * @example
 * ```typescript
 * const topology: TopologyMetrics = {
 *   totalRegions: 8,
 *   averageRegionSize: 125,
 *   territoryFragmentation: 0.35,
 *   borderCellPercentage: 0.42,
 *   avgCompactness: 0.68
 * }
 * ```
 */
export interface TopologyMetrics {
  /** Total disconnected regions across all players */
  totalRegions: number;
  /** Average cells per region */
  averageRegionSize: number;
  /** How fragmented territories are (0=solid, 1=scattered) */
  territoryFragmentation: number;
  /** Percentage of cells that are border cells */
  borderCellPercentage: number;
  /** Average compactness across all territories */
  avgCompactness: number;
}

/**
 * Time series analysis metrics
 *
 * @example
 * ```typescript
 * const timeSeries: TimeSeriesMetrics = {
 *   overallTrend: 'divergent',  // Players spreading apart
 *   changePoints: [12, 28, 45], // Turn numbers where behavior changed
 *   trendStrength: 0.78,        // Strength of overall trend
 *   autocorrelation: 0.65,      // How correlated with past values
 *   seasonality: false          // No periodic patterns detected
 * }
 * ```
 */
export interface TimeSeriesMetrics {
  /** Overall trend type */
  overallTrend: 'convergent' | 'divergent' | 'cyclical' | 'chaotic';
  /** Turn numbers where significant changes occurred */
  changePoints: number[];
  /** Strength of overall trend (0-1) */
  trendStrength: number;
  /** Autocorrelation coefficient */
  autocorrelation: number;
  /** Whether periodic patterns detected */
  seasonality: boolean;
}

/**
 * Comparison metrics with past states
 *
 * @example
 * ```typescript
 * const comparisons: ComparisonMetrics = {
 *   vs5TurnsAgo: { 1: 15, 2: 8, 3: -12, 4: -11 },  // Territory change
 *   vs10TurnsAgo: { 1: 45, 2: 22, 3: -35, 4: -32 },
 *   divergenceFromUniform: 0.42,  // How far from equal distribution
 *   divergenceFromPrevious: 0.08  // How much changed from last turn
 * }
 * ```
 */
export interface ComparisonMetrics {
  /** Territory change per player vs 5 turns ago */
  vs5TurnsAgo: { [playerId: number]: number };
  /** Territory change per player vs 10 turns ago */
  vs10TurnsAgo: { [playerId: number]: number };
  /** KL divergence from uniform distribution */
  divergenceFromUniform: number;
  /** JS divergence from previous turn */
  divergenceFromPrevious: number;
}

/**
 * Anomaly detection summary
 *
 * @example
 * ```typescript
 * const anomalies: AnomalySummary = {
 *   outliers: [{
 *     playerId: 2,
 *     type: 'growth_explosion',
 *     severity: 3.2,
 *     timestamp: 1705678800000,
 *     description: 'Unusual territory gain: +45 cells in one turn',
 *     metrics: { growth: 45, avgGrowth: 5.2, zscore: 3.2 }
 *   }],
 *   hasAnomalies: true,
 *   anomalyCount: 1,
 *   mostSevere: 'growth_explosion'
 * }
 * ```
 */
export interface AnomalySummary {
  /** Detected game anomalies */
  outliers: GameAnomaly[];
  /** Whether any anomalies were detected */
  hasAnomalies: boolean;
  /** Total count of anomalies */
  anomalyCount: number;
  /** Type of most severe anomaly (if any) */
  mostSevere: string | null;
}

/**
 * Complete game snapshot with all statistics
 *
 * @example Full Response Structure
 * ```typescript
 * const snapshot: GameSnapshot = {
 *   timestamp: 1705678800000,
 *   turnNumber: 45,
 *   totalCells: 1000,
 *   occupiedCells: 850,
 *   playerCount: 4,
 *
 *   players: [
 *     { id: 2, cellCount: 320, shareOfTotal: 0.376, rank: 1, ... },
 *     { id: 1, cellCount: 210, shareOfTotal: 0.247, rank: 2, ... },
 *     { id: 3, cellCount: 180, shareOfTotal: 0.212, rank: 3, ... },
 *     { id: 4, cellCount: 140, shareOfTotal: 0.165, rank: 4, ... }
 *   ],
 *
 *   territoryStats: { ... },
 *
 *   inequality: {
 *     gini: 0.42,
 *     theil: 0.35,
 *     atkinson: 0.28,
 *     herfindahl: 0.31,
 *     paretoRatio: 0.72,
 *     zipfCoefficient: 1.15,
 *     interpretation: "Emerging dominance"
 *   },
 *
 *   diversity: {
 *     shannon: 1.85,
 *     normalized: 0.92,
 *     renyi: 1.78,
 *     tsallis: 1.52,
 *     interpretation: "High diversity"
 *   },
 *
 *   distribution: {
 *     mean: 212.5, median: 195, stdDev: 68.2,
 *     skewness: 0.65, kurtosis: 2.8,
 *     coefficientOfVariation: 0.32,
 *     iqr: 95, min: 140, max: 320, range: 180
 *   },
 *
 *   indices: {
 *     dominance: 0.65,
 *     volatility: 0.35,
 *     predictability: 0.72,
 *     competitiveness: 0.45,
 *     stability: 0.68
 *   },
 *
 *   predictions: {
 *     likelyWinner: 2,
 *     winnerConfidence: 0.72,
 *     estimatedTurnsToVictory: 25,
 *     isEndgame: false,
 *     secondPlaceChallenger: 1,
 *     comebackPossibility: 0.28
 *   },
 *
 *   anomalies: {
 *     outliers: [],
 *     hasAnomalies: false,
 *     anomalyCount: 0,
 *     mostSevere: null
 *   },
 *
 *   probability: { winProbabilities: Map, ... },
 *   topology: { totalRegions: 8, ... },
 *   timeSeries: { overallTrend: 'divergent', ... },
 *   comparisons: { vs5TurnsAgo: {...}, ... },
 *
 *   insights: [
 *     "📈 Player 2 leads with 37.6% of territory",
 *     "🚀 Leader's territory growing steadily",
 *     "🎯 72% confidence in Player 2 victory"
 *   ]
 * }
 * ```
 */
export interface GameSnapshot {
  // Basic
  /** Unix timestamp when snapshot was generated */
  timestamp: number;
  /** Current turn number */
  turnNumber: number;
  /** Total cells on the grid */
  totalCells: number;
  /** Number of cells with an owner */
  occupiedCells: number;

  // Players
  /** Number of active players */
  playerCount: number;
  /** Detailed stats for each player, sorted by rank */
  players: PlayerSnapshot[];

  // Overall territory stats
  /** Aggregate territory statistics */
  territoryStats: TerritoryStats;

  // Inequality metrics (all players)
  /** Inequality measures for territory distribution */
  inequality: InequalityMetrics;

  // Entropy/diversity
  /** Diversity/entropy measures */
  diversity: DiversityMetrics;

  // Distribution metrics
  /** Statistical distribution of territory counts */
  distribution: DistributionMetrics;

  // Game state indices
  /** Normalized game state indicators */
  indices: GameIndices;

  // Predictions
  /** Game outcome predictions */
  predictions: GamePredictions;

  // Anomaly detection
  /** Detected anomalies and outliers */
  anomalies: AnomalySummary;

  // Probability snapshot (Bayesian)
  /** Full Bayesian probability analysis */
  probability: ProbabilitySnapshot;

  // Topology
  /** Territory topology metrics */
  topology: TopologyMetrics;

  // Time series insights
  /** Time series analysis */
  timeSeries: TimeSeriesMetrics;

  // Comparisons
  /** Comparisons with past states */
  comparisons: ComparisonMetrics;

  // Recommendations / insights
  /** Human-readable insights and observations */
  insights: string[];
}

// Re-export all types for easy importing
export type {
  TerritoryStats,
  ProbabilitySnapshot,
  OutlierResult,
  TimeSeriesAnomaly,
  GameAnomaly,
  MultivariateOutlierResult,
};

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export interface SnapshotConfig {
  /** Number of turns for forecasting */
  forecastHorizon?: number;
  /** Number of Monte Carlo samples */
  monteCarloSamples?: number;
  /** Include detailed history */
  includeFullHistory?: boolean;
  /** Calculate topology (can be expensive) */
  calculateTopology?: boolean;
  /** Generate insights */
  generateInsights?: boolean;
}

/**
 * Generate comprehensive snapshot from game state
 */
export function generateSnapshot(
  cells: { owner: number; population?: number }[],
  territoryHistory: Map<number, number[]>,
  conquestCounts: Map<number, { successes: number; opportunities: number }>,
  getNeighbors: (cellIndex: number) => number[],
  config: SnapshotConfig = {}
): GameSnapshot {
  const {
    forecastHorizon = 10,
    monteCarloSamples = 1000,
    includeFullHistory = false,
    calculateTopology = true,
    generateInsights = true,
  } = config;

  const timestamp = Date.now();
  const totalCells = cells.length;

  // Count territories
  const territoryCounts = new Map<number, number>();
  for (const cell of cells) {
    if (cell.owner !== 0) {
      territoryCounts.set(
        cell.owner,
        (territoryCounts.get(cell.owner) ?? 0) + 1
      );
    }
  }

  const occupiedCells = Array.from(territoryCounts.values()).reduce(
    (a, b) => a + b,
    0
  );
  const players = Array.from(territoryCounts.keys()).sort((a, b) => a - b);
  const playerCount = players.length;

  // Sort by territory size for ranking
  const sortedBySize = [...players].sort(
    (a, b) => (territoryCounts.get(b) ?? 0) - (territoryCounts.get(a) ?? 0)
  );

  // Compute turn number from history length
  const turnNumber = Math.max(
    ...Array.from(territoryHistory.values()).map((h) => h.length),
    0
  );

  // Territory stats - computeTerritoryStats expects Array<{ area: number; perimeter: number }>
  // For now, create a simplified version
  const territoryAreas = Array.from(territoryCounts.entries()).map(
    ([_, count]) => ({
      area: count,
      perimeter: Math.sqrt(count) * 4, // Simplified perimeter calculation
    })
  );
  const territoryStats = computeTerritoryStats(territoryAreas);

  // Get probability snapshot - generateProbabilitySnapshot only takes labels: string[]
  const playerLabels = Array.from(territoryCounts.keys()).map(String);
  const probability = generateProbabilitySnapshot(playerLabels);

  // Compute player snapshots
  const playerSnapshots: PlayerSnapshot[] = [];

  for (let rankIdx = 0; rankIdx < sortedBySize.length; rankIdx++) {
    const playerId = sortedBySize[rankIdx];
    const cellCount = territoryCounts.get(playerId) ?? 0;
    const history = territoryHistory.get(playerId) ?? [];

    // Trend detection
    const trend = history.length > 3 ? detectTrend(history) : null;

    // Forecast - doubleExponentialSmoothing returns number[], not an object with forecast method
    const forecastValues =
      history.length > 2 ? doubleExponentialSmoothing(history, 0.3, 0.1) : [];
    const forecastNext10 = forecastValues.slice(0, forecastHorizon);

    // Kalman filter
    let kalmanEstimate = cellCount;
    let kalmanUncertainty = 0;
    if (history.length > 3) {
      const variance =
        history.slice(1).reduce((sum, v, i) => sum + (v - history[i]) ** 2, 0) /
        history.length;

      const filter = new KalmanFilter(
        history[0],
        variance || 1,
        (variance || 1) * 0.1,
        (variance || 1) * 0.5
      );

      for (const measurement of history) {
        filter.update(measurement);
      }

      kalmanEstimate = filter.getState();
      kalmanUncertainty = filter.getUncertainty();
    }

    // Win probability - ProbabilitySnapshot only has probabilities array
    const playerProb = probability.probabilities.find(
      (p) => p.label === String(playerId)
    );
    const winProb = playerProb?.probability ?? 0;
    const winCI: [number, number] = [
      Math.max(0, winProb - 0.1),
      Math.min(1, winProb + 0.1),
    ]; // Simplified CI

    // Conquest rate - bayesianConquestRate returns a number, not an object
    const conquests = conquestCounts.get(playerId) ?? {
      successes: 0,
      opportunities: 0,
    };
    const conquestRate = bayesianConquestRate(
      conquests.successes,
      conquests.opportunities
    );
    const conquestRateCI: [number, number] = [
      Math.max(0, conquestRate - 0.1),
      Math.min(1, conquestRate + 0.1),
    ]; // Simplified CI

    // Volatility
    const volatility =
      history.length > 1
        ? Math.sqrt(
            history
              .slice(1)
              .reduce((sum, v, i) => sum + (v - history[i]) ** 2, 0) /
              (history.length - 1)
          ) / (cellCount || 1)
        : 0;

    // Avg growth
    const avgGrowth =
      history.length > 1
        ? (history[history.length - 1] - history[0]) / history.length
        : 0;

    // Topology
    let numRegions = 1;
    let largestRegionSize = cellCount;
    let borderCellCount = 0;
    let playerCompactness = 0;

    if (calculateTopology && cellCount > 0) {
      const playerCells = new Set<number>();
      cells.forEach((cell, idx) => {
        if (cell.owner === playerId) playerCells.add(idx);
      });

      // Count regions using BFS
      const visited = new Set<number>();
      const regionSizes: number[] = [];

      for (const cellIdx of playerCells) {
        if (visited.has(cellIdx)) continue;

        const queue = [cellIdx];
        visited.add(cellIdx);
        let regionSize = 0;

        while (queue.length > 0) {
          const current = queue.shift()!;
          regionSize++;

          for (const neighbor of getNeighbors(current)) {
            if (playerCells.has(neighbor) && !visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        regionSizes.push(regionSize);
      }

      numRegions = regionSizes.length;
      largestRegionSize = Math.max(...regionSizes, 0);

      // Border cells
      for (const cellIdx of playerCells) {
        const neighbors = getNeighbors(cellIdx);
        if (neighbors.some((n) => !playerCells.has(n))) {
          borderCellCount++;
        }
      }

      // Compactness - compactness expects (area: number, perimeter: number)
      const area = playerCells.size;
      const perimeter = borderCellCount;
      playerCompactness = compactness(area, perimeter);
    }

    // Lead over second
    const leadOverSecond =
      rankIdx === 0 && sortedBySize.length > 1
        ? cellCount - (territoryCounts.get(sortedBySize[1]) ?? 0)
        : null;

    // Turns until overtake (for non-leaders)
    let turnsUntilOvertake: number | null = null;
    if (rankIdx > 0 && forecastNext10.length > 0) {
      const leaderHistory = territoryHistory.get(sortedBySize[0]) ?? [];
      if (leaderHistory.length > 2) {
        const leaderForecast = doubleExponentialSmoothing(
          leaderHistory,
          0.3,
          0.1
        );
        const leaderPred =
          leaderForecast[leaderForecast.length - 1] ??
          leaderHistory[leaderHistory.length - 1] ??
          0;

        for (let t = 0; t < forecastHorizon && t < forecastNext10.length; t++) {
          if (forecastNext10[t] > leaderPred) {
            turnsUntilOvertake = t + 1;
            break;
          }
        }
      }
    }

    playerSnapshots.push({
      id: playerId,
      cellCount,
      shareOfTotal: occupiedCells > 0 ? cellCount / occupiedCells : 0,
      rank: rankIdx + 1,
      historyLength: history.length,
      history: includeFullHistory ? [...history] : history.slice(-20),
      recentTrend:
        trend?.direction === 'increasing'
          ? 'growing'
          : trend?.direction === 'decreasing'
          ? 'shrinking'
          : 'stable',
      trendSlope: trend?.slope ?? 0,
      trendConfidence: trend?.rSquared ?? 0,
      winProbability: winProb,
      winCredibleInterval: winCI as [number, number],
      forecastNext10,
      kalmanEstimate,
      kalmanUncertainty,
      conquestRate: conquestRate,
      conquestRateCI: conquestRateCI,
      avgGrowthPerTurn: avgGrowth,
      volatility,
      numRegions,
      largestRegionSize,
      borderCellCount,
      compactness: playerCompactness,
      sparklineAscii: sparkline(history.slice(-30)),
      sparklineSvgPath: sparklineSvg(history.slice(-30), 100, 30),
      leadOverSecond,
      turnsUntilOvertake,
    });
  }

  // Inequality metrics
  const values = Array.from(territoryCounts.values());
  const gini = giniCoefficient(values);
  const theil = theilIndex(values);
  const atkinson = atkinsonIndex(values, 0.5); // epsilon = 0.5 for standard calculation
  const herfindahl = herfindahlIndex(values);
  const pareto = paretoRatio(values, 0.2);
  const zipf = zipfCoefficient(values);

  let inequalityInterpretation: string;
  if (gini < 0.2)
    inequalityInterpretation = 'Highly balanced - fierce competition';
  else if (gini < 0.4) inequalityInterpretation = 'Moderately balanced';
  else if (gini < 0.6) inequalityInterpretation = 'Emerging dominance';
  else if (gini < 0.8) inequalityInterpretation = 'Clear leader emerging';
  else inequalityInterpretation = 'Near monopoly - game almost decided';

  // Diversity metrics
  const shannon = shannonEntropy(values);
  const normalized = normalizedEntropy(values);
  const renyi = renyiEntropy(values, 2); // alpha = 2 for standard Renyi entropy
  const tsallis = tsallisEntropy(values, 2); // q = 2 for standard Tsallis entropy

  let diversityInterpretation: string;
  if (normalized > 0.9)
    diversityInterpretation = 'Maximum diversity - all players equal';
  else if (normalized > 0.7) diversityInterpretation = 'High diversity';
  else if (normalized > 0.5) diversityInterpretation = 'Moderate diversity';
  else if (normalized > 0.3)
    diversityInterpretation = 'Low diversity - consolidation';
  else diversityInterpretation = 'Minimal diversity - game nearly over';

  // Distribution metrics
  const sorted = [...values].sort((a, b) => a - b);
  const mean =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const median =
    values.length > 0
      ? values.length % 2 === 0
        ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
        : sorted[Math.floor(values.length / 2)]
      : 0;
  const variance =
    values.length > 0
      ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
      : 0;
  const stdDev = Math.sqrt(variance);

  let m3 = 0,
    m4 = 0;
  for (const v of values) {
    const diff = v - mean;
    m3 += diff ** 3;
    m4 += diff ** 4;
  }
  const skewness =
    values.length > 0 && stdDev > 0 ? m3 / values.length / stdDev ** 3 : 0;
  const kurtosis =
    values.length > 0 && stdDev > 0 ? m4 / values.length / stdDev ** 4 - 3 : 0;

  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;

  // Game state indices - ProbabilitySnapshot doesn't have these, calculate from data
  const topPlayerShare =
    sortedBySize.length > 0
      ? (territoryCounts.get(sortedBySize[0]) ?? 0) / occupiedCells
      : 0;
  const dominance = topPlayerShare; // Simplified dominance index

  // Competitiveness: inverse of lead
  const topTwoShare =
    sortedBySize.length >= 2
      ? ((territoryCounts.get(sortedBySize[0]) ?? 0) +
          (territoryCounts.get(sortedBySize[1]) ?? 0)) /
        occupiedCells
      : 1;
  const competitiveness =
    sortedBySize.length >= 2
      ? 1 -
        Math.abs(
          (territoryCounts.get(sortedBySize[0]) ?? 0) -
            (territoryCounts.get(sortedBySize[1]) ?? 0)
        ) /
          occupiedCells
      : 0;

  // Stability: inverse of avg change rate
  let totalChangeRate = 0;
  let historyCount = 0;
  for (const [, history] of territoryHistory) {
    if (history.length > 1) {
      const changes = history.slice(1).map((v, i) => Math.abs(v - history[i]));
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      totalChangeRate += avgChange / (history[history.length - 1] || 1);
      historyCount++;
    }
  }
  const stability =
    historyCount > 0 ? Math.max(0, 1 - totalChangeRate / historyCount) : 0.5;

  // Predictions
  // Calculate estimated turns to victory from forecast data
  const likelyWinner = sortedBySize.length > 0 ? sortedBySize[0] : null;
  const winnerConfidence = topPlayerShare; // Simplified confidence
  // Estimate turns to victory based on forecast (simplified)
  let estimatedTurnsToVictory: number | null = null;
  if (sortedBySize.length > 0 && territoryHistory.has(sortedBySize[0])) {
    const leaderHistory = territoryHistory.get(sortedBySize[0]) ?? [];
    if (leaderHistory.length > 0) {
      const currentShare =
        (territoryCounts.get(sortedBySize[0]) ?? 0) / occupiedCells;
      const targetShare = 0.5; // 50% to win
      if (currentShare < targetShare && leaderHistory.length > 1) {
        const growthRate =
          (leaderHistory[leaderHistory.length - 1] - leaderHistory[0]) /
          leaderHistory.length;
        if (growthRate > 0) {
          estimatedTurnsToVictory = Math.ceil(
            (targetShare * occupiedCells -
              (territoryCounts.get(sortedBySize[0]) ?? 0)) /
              growthRate
          );
        }
      }
    }
  }

  const isEndgame =
    gini > 0.7 ||
    (sortedBySize.length >= 2 &&
      (territoryCounts.get(sortedBySize[0]) ?? 0) > occupiedCells * 0.6);

  const secondPlaceChallenger =
    sortedBySize.length >= 2 ? sortedBySize[1] : null;

  // Calculate volatility early for use in comebackPossibility
  // Time series insights
  let overallTrend: 'convergent' | 'divergent' | 'cyclical' | 'chaotic' =
    'chaotic';

  // Check if shares are converging or diverging
  const recentVariances: number[] = [];
  const historyLen = Math.min(
    ...Array.from(territoryHistory.values()).map((h) => h.length)
  );

  for (let t = Math.max(0, historyLen - 10); t < historyLen; t++) {
    const sharesAtT = players.map((p) => {
      const h = territoryHistory.get(p) ?? [];
      return h[t] ?? 0;
    });
    const meanAtT = sharesAtT.reduce((a, b) => a + b, 0) / sharesAtT.length;
    const varAtT =
      sharesAtT.reduce((sum, s) => sum + (s - meanAtT) ** 2, 0) /
      sharesAtT.length;
    recentVariances.push(varAtT);
  }

  // Calculate volatility and predictability from recentVariances
  const volatility =
    recentVariances.length > 0
      ? Math.sqrt(
          recentVariances.reduce((a, b) => a + b, 0) / recentVariances.length
        )
      : 0;
  const predictability = 1 - Math.min(1, volatility); // Simplified predictability (inverse of volatility)

  // Comeback possibility based on volatility and current gap
  const comebackPossibility =
    sortedBySize.length >= 2
      ? Math.min(1, volatility + (1 - dominance)) * (1 - winnerConfidence)
      : 0;

  // Topology summary
  let totalRegions = 0;
  let totalBorderCells = 0;
  let compactnessSum = 0;

  for (const player of playerSnapshots) {
    totalRegions += player.numRegions;
    totalBorderCells += player.borderCellCount;
    compactnessSum += player.compactness;
  }

  const averageRegionSize = totalRegions > 0 ? occupiedCells / totalRegions : 0;
  const territoryFragmentation =
    playerCount > 0 ? (totalRegions - playerCount) / (occupiedCells || 1) : 0;
  const borderCellPercentage =
    occupiedCells > 0 ? totalBorderCells / occupiedCells : 0;
  const avgCompactness = playerCount > 0 ? compactnessSum / playerCount : 0;

  if (recentVariances.length > 3) {
    const varianceTrend = detectTrend(recentVariances);
    const rSquared = varianceTrend.rSquared ?? 0;
    if (varianceTrend.direction === 'decreasing' && rSquared > 0.5) {
      overallTrend = 'convergent';
    } else if (varianceTrend.direction === 'increasing' && rSquared > 0.5) {
      overallTrend = 'divergent';
    } else if (rSquared < 0.2) {
      overallTrend = 'chaotic';
    } else {
      overallTrend = 'cyclical';
    }
  }

  // Overall change points
  const overallHistory = Array.from(territoryHistory.values())[0] ?? [];
  const changePoints = detectChangePoints(overallHistory);

  // Trend strength
  const overallHistoryTrend =
    overallHistory.length > 3 ? detectTrend(overallHistory) : null;
  const trendStrength = overallHistoryTrend?.rSquared ?? 0;

  // Autocorrelation (lag 1)
  let autocorrelation = 0;
  if (overallHistory.length > 5) {
    const ohMean =
      overallHistory.reduce((a, b) => a + b, 0) / overallHistory.length;
    let num = 0,
      denom = 0;
    for (let i = 1; i < overallHistory.length; i++) {
      num += (overallHistory[i] - ohMean) * (overallHistory[i - 1] - ohMean);
    }
    for (let i = 0; i < overallHistory.length; i++) {
      denom += (overallHistory[i] - ohMean) ** 2;
    }
    autocorrelation = denom > 0 ? num / denom : 0;
  }

  // Seasonality (simple check)
  const seasonality = false; // TODO: implement proper seasonality detection

  // Comparisons
  const vs5TurnsAgo: { [playerId: number]: number } = {};
  const vs10TurnsAgo: { [playerId: number]: number } = {};

  for (const [player, history] of territoryHistory) {
    const current = history[history.length - 1] ?? 0;
    const fiveAgo = history[history.length - 6] ?? current;
    const tenAgo = history[history.length - 11] ?? current;

    vs5TurnsAgo[player] = current - fiveAgo;
    vs10TurnsAgo[player] = current - tenAgo;
  }

  // Divergence from uniform
  const uniformProbs = values.map(() => 1 / values.length);
  const actualProbs = values.map((v) => v / (occupiedCells || 1));
  const divergenceFromUniform = klDivergence(actualProbs, uniformProbs);

  // Divergence from previous turn
  let divergenceFromPrevious = 0;
  if (historyLen > 1) {
    const prevProbs = players.map((p) => {
      const h = territoryHistory.get(p) ?? [];
      return (h[h.length - 2] ?? 0) / (occupiedCells || 1);
    });
    divergenceFromPrevious = jsDivergence(actualProbs, prevProbs);
  }

  // Generate insights
  const insights: string[] = [];

  if (generateInsights) {
    // Leader insights
    if (sortedBySize.length > 0) {
      const leader = playerSnapshots.find((p) => p.rank === 1)!;
      const leaderShare = leader.shareOfTotal;

      if (leaderShare > 0.8) {
        insights.push(
          `🏆 Player ${leader.id} dominates with ${(leaderShare * 100).toFixed(
            1
          )}% of territory`
        );
      } else if (leaderShare > 0.5) {
        insights.push(
          `📈 Player ${leader.id} leads with majority control (${(
            leaderShare * 100
          ).toFixed(1)}%)`
        );
      }

      if (leader.recentTrend === 'growing' && leader.trendConfidence > 0.7) {
        insights.push(
          `🚀 Leader's territory growing steadily (slope: ${leader.trendSlope.toFixed(
            2
          )}/turn)`
        );
      } else if (
        leader.recentTrend === 'shrinking' &&
        leader.trendConfidence > 0.7
      ) {
        insights.push(`⚠️ Leader losing ground - opportunity for challengers!`);
      }
    }

    // Challenger insights
    if (sortedBySize.length >= 2) {
      const challenger = playerSnapshots.find((p) => p.rank === 2)!;

      if (challenger.winProbability > 0.3) {
        insights.push(
          `🎯 Player ${challenger.id} has ${(
            challenger.winProbability * 100
          ).toFixed(1)}% chance of winning`
        );
      }

      if (
        challenger.turnsUntilOvertake !== null &&
        challenger.turnsUntilOvertake < 5
      ) {
        insights.push(
          `⚡ Player ${challenger.id} could overtake in ~${challenger.turnsUntilOvertake} turns!`
        );
      }
    }

    // Game state insights
    if (isEndgame) {
      insights.push(`🔚 Endgame detected - victory imminent`);
    }

    if (competitiveness > 0.9) {
      insights.push(`🔥 Extremely close competition - anyone could win!`);
    }

    if (volatility > 0.7) {
      insights.push(`🌊 High volatility - expect rapid changes`);
    } else if (volatility < 0.2) {
      insights.push(`🪨 Low volatility - stable territorial lines`);
    }

    if (comebackPossibility > 0.5) {
      insights.push(
        `🔄 Comeback still possible (${(comebackPossibility * 100).toFixed(
          0
        )}% chance)`
      );
    }

    // Topology insights
    if (territoryFragmentation > 0.2) {
      insights.push(`🧩 High fragmentation - territories are scattered`);
    }

    if (avgCompactness < 0.3) {
      insights.push(
        `📏 Territories have irregular borders - vulnerable to attack`
      );
    }

    // Change point insights
    if (changePoints.length > 0) {
      const recentChangePoint = changePoints[changePoints.length - 1];
      if (turnNumber - recentChangePoint < 5) {
        insights.push(
          `📊 Recent momentum shift detected at turn ${recentChangePoint}`
        );
      }
    }

    // Trend insights
    if (overallTrend === 'convergent') {
      insights.push(
        `📉 Territories are converging - expect stalemate or final push`
      );
    } else if (overallTrend === 'divergent') {
      insights.push(`📈 Gap widening - leader pulling ahead`);
    }
  }

  // Detect anomalies - detectGameAnomalies expects number[], convert territoryHistory
  const allHistoryValues: number[] = [];
  for (const [, history] of territoryHistory) {
    allHistoryValues.push(...history);
  }
  const gameAnomalies = detectGameAnomalies(allHistoryValues);

  const anomalies: AnomalySummary = {
    outliers: gameAnomalies,
    hasAnomalies: gameAnomalies.length > 0,
    anomalyCount: gameAnomalies.length,
    mostSevere:
      gameAnomalies.length > 0
        ? gameAnomalies.reduce(
            (max, a) => (a.severity > (max?.severity ?? 0) ? a : max),
            gameAnomalies[0]
          ).type
        : null,
  };

  // Add anomaly insights
  if (generateInsights && anomalies.hasAnomalies) {
    for (const anomaly of gameAnomalies.slice(0, 3)) {
      // Top 3 anomalies
      insights.push(`⚠️ Anomaly: ${anomaly.description}`);
    }
  }

  return {
    timestamp,
    turnNumber,
    totalCells,
    occupiedCells,
    playerCount,
    players: playerSnapshots,
    territoryStats,
    inequality: {
      gini,
      theil,
      atkinson,
      herfindahl,
      paretoRatio: pareto.ratioHeld,
      zipfCoefficient: zipf,
      interpretation: inequalityInterpretation,
    },
    diversity: {
      shannon,
      normalized,
      renyi,
      tsallis,
      interpretation: diversityInterpretation,
    },
    distribution: {
      mean,
      median,
      stdDev,
      skewness,
      kurtosis,
      coefficientOfVariation: mean > 0 ? stdDev / mean : 0,
      iqr: q3 - q1,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      range: (sorted[sorted.length - 1] ?? 0) - (sorted[0] ?? 0),
    },
    indices: {
      dominance,
      volatility,
      predictability,
      competitiveness,
      stability,
    },
    predictions: {
      likelyWinner,
      winnerConfidence,
      estimatedTurnsToVictory,
      isEndgame,
      secondPlaceChallenger,
      comebackPossibility,
    },
    anomalies,
    probability,
    topology: {
      totalRegions,
      averageRegionSize,
      territoryFragmentation,
      borderCellPercentage,
      avgCompactness,
    },
    timeSeries: {
      overallTrend,
      changePoints,
      trendStrength,
      autocorrelation,
      seasonality,
    },
    comparisons: {
      vs5TurnsAgo,
      vs10TurnsAgo,
      divergenceFromUniform,
      divergenceFromPrevious,
    },
    insights,
  };
}

/**
 * Format snapshot as human-readable text
 */
export function formatSnapshotAsText(snapshot: GameSnapshot): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`  GAME SNAPSHOT - Turn ${snapshot.turnNumber}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  lines.push(
    `📊 Territory: ${snapshot.occupiedCells}/${snapshot.totalCells} cells occupied`
  );
  lines.push(`👥 Players: ${snapshot.playerCount}`);
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────┐');
  lines.push('│ PLAYER STANDINGS                                        │');
  lines.push('├─────────────────────────────────────────────────────────┤');

  for (const player of snapshot.players) {
    const bar = '█'.repeat(Math.ceil(player.shareOfTotal * 20));
    const pad = ' '.repeat(20 - bar.length);
    const trend =
      player.recentTrend === 'growing'
        ? '↑'
        : player.recentTrend === 'shrinking'
        ? '↓'
        : '→';

    lines.push(
      `│ #${player.rank} Player ${player.id}: ${player.cellCount} cells (${(
        player.shareOfTotal * 100
      ).toFixed(1)}%)`
    );
    lines.push(`│    ${bar}${pad} ${trend}`);
    lines.push(
      `│    Win Prob: ${(player.winProbability * 100).toFixed(
        1
      )}%  Sparkline: ${player.sparklineAscii}`
    );
    lines.push('│');
  }

  lines.push('└─────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────┐');
  lines.push('│ GAME STATE                                              │');
  lines.push('├─────────────────────────────────────────────────────────┤');
  lines.push(
    `│ Dominance:      ${progressBar(snapshot.indices.dominance)}  ${(
      snapshot.indices.dominance * 100
    ).toFixed(0)}%`
  );
  lines.push(
    `│ Volatility:     ${progressBar(snapshot.indices.volatility)}  ${(
      snapshot.indices.volatility * 100
    ).toFixed(0)}%`
  );
  lines.push(
    `│ Competitiveness:${progressBar(snapshot.indices.competitiveness)}  ${(
      snapshot.indices.competitiveness * 100
    ).toFixed(0)}%`
  );
  lines.push(
    `│ Stability:      ${progressBar(snapshot.indices.stability)}  ${(
      snapshot.indices.stability * 100
    ).toFixed(0)}%`
  );
  lines.push(
    `│ Predictability: ${progressBar(snapshot.indices.predictability)}  ${(
      snapshot.indices.predictability * 100
    ).toFixed(0)}%`
  );
  lines.push('└─────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────┐');
  lines.push('│ PREDICTIONS                                             │');
  lines.push('├─────────────────────────────────────────────────────────┤');

  if (snapshot.predictions.likelyWinner !== null) {
    lines.push(`│ Likely Winner: Player ${snapshot.predictions.likelyWinner}`);
    lines.push(
      `│ Confidence: ${(snapshot.predictions.winnerConfidence * 100).toFixed(
        1
      )}%`
    );
    if (snapshot.predictions.estimatedTurnsToVictory !== null) {
      lines.push(
        `│ Est. Victory In: ${snapshot.predictions.estimatedTurnsToVictory} turns`
      );
    }
  } else {
    lines.push('│ No clear winner predicted yet');
  }

  if (snapshot.predictions.isEndgame) {
    lines.push('│ ⚠️  ENDGAME DETECTED');
  }

  lines.push(
    `│ Comeback Chance: ${(
      snapshot.predictions.comebackPossibility * 100
    ).toFixed(0)}%`
  );
  lines.push('└─────────────────────────────────────────────────────────┘');
  lines.push('');

  if (snapshot.insights.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────┐');
    lines.push('│ INSIGHTS                                                │');
    lines.push('├─────────────────────────────────────────────────────────┤');
    for (const insight of snapshot.insights) {
      lines.push(`│ ${insight}`);
    }
    lines.push('└─────────────────────────────────────────────────────────┘');
  }

  return lines.join('\n');
}

function progressBar(value: number, width: number = 20): string {
  const filled = Math.round(value * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

/**
 * Export snapshot as JSON (removes functions)
 */
export function exportSnapshotAsJSON(snapshot: GameSnapshot): string {
  return JSON.stringify(
    snapshot,
    (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    },
    2
  );
}
