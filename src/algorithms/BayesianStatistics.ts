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

  constructor(initialState: number, initialUncertainty: number, processNoise: number, measurementNoise: number) {
    this.state = initialState;
    this.uncertainty = initialUncertainty;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  update(measurement: number): void {
    const predictedUncertainty = this.uncertainty + this.processNoise;
    const kalmanGain = predictedUncertainty / (predictedUncertainty + this.measurementNoise);
    this.state = this.state + kalmanGain * (measurement - this.state);
    this.uncertainty = (1 - kalmanGain) * predictedUncertainty;
  }

  forecast(steps: number): { predictions: number[]; uncertainties: number[] } {
    const predictions: number[] = [];
    const uncertainties: number[] = [];
    let state = this.state;
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

export function bayesianConquestRate(successes: number, trials: number): number {
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

export function generateProbabilitySnapshot(labels: string[]): ProbabilitySnapshot {
  const probability = labels.length > 0 ? 1 / labels.length : 0;
  return {
    probabilities: labels.map((label) => ({ label, probability })),
  };
}
