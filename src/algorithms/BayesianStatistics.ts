export class BetaDistribution {
  alpha: number;
  beta: number;

  constructor(alpha: number, beta: number) {
    this.alpha = alpha;
    this.beta = beta;
  }

  mean(): number {
    const total = this.alpha + this.beta;
    return total === 0 ? 0.5 : this.alpha / total;
  }

  variance(): number {
    const total = this.alpha + this.beta;
    if (total <= 1) return 0;
    return (this.alpha * this.beta) / (total * total * (total + 1));
  }
}

export class MarkovChain {
  private transitions: Map<string, Map<string, number>> = new Map();

  addTransition(from: string, to: string): void {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Map());
    }
    const map = this.transitions.get(from)!;
    map.set(to, (map.get(to) ?? 0) + 1);
  }

  probabilities(from: string): Array<{ to: string; probability: number }> {
    const map = this.transitions.get(from);
    if (!map) return [];
    const total = Array.from(map.values()).reduce((sum, val) => sum + val, 0);
    return Array.from(map.entries()).map(([to, count]) => ({
      to,
      probability: total === 0 ? 0 : count / total,
    }));
  }
}

export class KalmanFilter {
  private state: number;
  private uncertainty: number;
  private processNoise: number;
  private measurementNoise: number;

  constructor(
    initialState: number,
    initialUncertainty: number,
    processNoise: number,
    measurementNoise: number
  ) {
    this.state = initialState;
    this.uncertainty = initialUncertainty;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  update(measurement: number): void {
    const predictedUncertainty = this.uncertainty + this.processNoise;
    const kalmanGain =
      predictedUncertainty / (predictedUncertainty + this.measurementNoise);
    this.state = this.state + kalmanGain * (measurement - this.state);
    this.uncertainty = (1 - kalmanGain) * predictedUncertainty;
  }

  step(): number {
    // Predict next state without measurement
    this.uncertainty += this.processNoise;
    return this.state;
  }

  predict(_steps: number = 1): number {
    // Predict future state — grow uncertainty by steps without changing state
    this.uncertainty += this.processNoise * _steps;
    return this.state;
  }

  forecast(steps: number): { predictions: number[]; uncertainties: number[] } {
    const predictions: number[] = [];
    const uncertainties: number[] = [];
    const state = this.state;
    let uncertainty = this.uncertainty;

    for (let i = 0; i < steps; i++) {
      uncertainty += this.processNoise;
      predictions.push(state);
      uncertainties.push(uncertainty);
    }

    return { predictions, uncertainties };
  }

  getState(): number {
    return this.state;
  }

  getUncertainty(): number {
    return this.uncertainty;
  }
}

export function bayesianWinProbability(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
}

export function bayesianConquestRate(
  successes: number,
  trials: number
): number {
  if (trials === 0) return 0;
  return successes / trials;
}

export function bayesianChangepoint(values: number[]): number {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  return mid;
}

export interface ProbabilitySnapshot {
  probabilities: Array<{ label: string; probability: number }>;
}

export function generateProbabilitySnapshot(
  labels: string[]
): ProbabilitySnapshot {
  const probability = labels.length > 0 ? 1 / labels.length : 0;
  return {
    probabilities: labels.map((label) => ({ label, probability })),
  };
}

// Dirichlet Distribution
export class DirichletDistribution {
  private alphas: number[];

  constructor(alphas: number[]) {
    this.alphas = alphas;
  }

  mean(): number[] {
    const sum = this.alphas.reduce((s, a) => s + a, 0);
    return this.alphas.map((a) => (sum === 0 ? 0 : a / sum));
  }
}

// Normal Distribution
export class NormalDistribution {
  private mean: number;
  private variance: number;

  constructor(mean: number, variance: number) {
    this.mean = mean;
    this.variance = variance;
  }

  sample(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * Math.sqrt(this.variance) + this.mean;
  }
}

// Poisson Distribution
export class PoissonDistribution {
  private lambda: number;

  constructor(lambda: number) {
    this.lambda = lambda;
  }

  sample(): number {
    let k = 0;
    let p = 1;
    const L = Math.exp(-this.lambda);
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
}

// Exponential Distribution
export class ExponentialDistribution {
  private lambda: number;

  constructor(lambda: number) {
    this.lambda = lambda;
  }

  sample(): number {
    return -Math.log(1 - Math.random()) / this.lambda;
  }
}

// Hidden Markov Model
export class HiddenMarkovModel {
  private _states: string[];
  private transitions: Map<string, Map<string, number>>;
  private emissions: Map<string, Map<string, number>>;

  constructor(states: string[]) {
    this._states = states;
    this.transitions = new Map();
    this.emissions = new Map();
  }

  getStates(): string[] {
    return this._states;
  }

  addTransition(from: string, to: string, probability: number): void {
    if (!this.transitions.has(from)) {
      this.transitions.set(from, new Map());
    }
    this.transitions.get(from)!.set(to, probability);
  }

  addEmission(state: string, observation: string, probability: number): void {
    if (!this.emissions.has(state)) {
      this.emissions.set(state, new Map());
    }
    this.emissions.get(state)!.set(observation, probability);
  }
}

// Bayesian A/B Test
export function bayesianABTest(
  successA: number,
  trialsA: number,
  successB: number,
  trialsB: number
): number {
  const probA = trialsA === 0 ? 0.5 : successA / trialsA;
  const probB = trialsB === 0 ? 0.5 : successB / trialsB;
  return probB - probA; // Difference in probabilities
}

// Bayes Factor
export function bayesFactor(
  priorOdds: number,
  likelihoodRatio: number
): number {
  return priorOdds * likelihoodRatio;
}

// MAP Estimate (Maximum A Posteriori)
export function mapEstimate(
  data: number[],
  prior: { alpha: number; beta: number }
): number {
  const sum = data.reduce((s, x) => s + x, 0);
  const _n = data.length;
  const alpha = prior.alpha + sum;
  const beta = prior.beta + _n - sum;
  return alpha / (alpha + beta);
}

// Learn Markov Chain from sequence
export function learnMarkovChain(sequence: string[]): MarkovChain {
  const chain = new MarkovChain();
  for (let i = 0; i < sequence.length - 1; i++) {
    chain.addTransition(sequence[i]!, sequence[i + 1]!);
  }
  return chain;
}

// Bootstrap Confidence Interval
export function bootstrapConfidenceInterval(
  data: number[],
  iterations: number = 1000,
  confidence: number = 0.95
): { lower: number; upper: number } {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < data.length; j++) {
      sample.push(data[Math.floor(Math.random() * data.length)] ?? 0);
    }
    samples.push(sample.reduce((s, x) => s + x, 0) / sample.length);
  }
  samples.sort((a, b) => a - b);
  const lowerIdx = Math.floor(((1 - confidence) / 2) * samples.length);
  const upperIdx = Math.floor(((1 + confidence) / 2) * samples.length);
  return {
    lower: samples[lowerIdx] ?? 0,
    upper: samples[upperIdx] ?? 0,
  };
}

// Monte Carlo Integration
export function monteCarloIntegrate(
  fn: (x: number) => number,
  a: number,
  b: number,
  samples: number = 1000
): number {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const x = a + Math.random() * (b - a);
    sum += fn(x);
  }
  return ((b - a) * sum) / samples;
}

// Mutual Information
export function mutualInformation(x: number[], y: number[]): number {
  // Simplified implementation
  if (x.length !== y.length || x.length === 0) return 0;
  const hx = shannonEntropy(x);
  const hy = shannonEntropy(y);
  // Simplified: assume independence for now
  return Math.max(0, hx + hy - (hx + hy) * 0.5);
}

function shannonEntropy(values: number[]): number {
  const total = values.reduce((s, v) => s + Math.abs(v), 0);
  if (total === 0) return 0;
  return values.reduce((sum, val) => {
    const p = Math.abs(val) / total;
    return p === 0 ? sum : sum - p * Math.log2(p);
  }, 0);
}

// Conditional Entropy
export function conditionalEntropy(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  // Simplified: return marginal entropy
  return shannonEntropy(x);
}

// Normalized Mutual Information
export function normalizedMutualInformation(x: number[], y: number[]): number {
  const mi = mutualInformation(x, y);
  const hx = shannonEntropy(x);
  const hy = shannonEntropy(y);
  const denom = Math.sqrt(hx * hy);
  return denom === 0 ? 0 : mi / denom;
}

// Math Utilities

const LANCZOS_COEFFICIENTS = [
  76.18009172947146, -86.50532032941678, 24.01409824083091,
  -1.231739572450155, 1.20865097386618e-3, -5.395239384953e-6,
];

export function logGamma(x: number): number {
  if (x <= 0) return Infinity;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < LANCZOS_COEFFICIENTS.length; i++) {
    a += LANCZOS_COEFFICIENTS[i] / (x + 1 + i);
  }
  const t = x + LANCZOS_COEFFICIENTS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function gamma(x: number): number {
  return Math.exp(logGamma(x));
}

export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

export function betaFunction(a: number, b: number): number {
  return Math.exp(logBeta(a, b));
}

export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n >= 171) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}
