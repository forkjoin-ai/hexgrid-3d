/**
 * Bayesian and Probabilistic Statistics Module
 * 
 * Professional-grade probabilistic analysis for territory dynamics
 * including Bayesian inference, probability distributions, Monte Carlo
 * simulations, and predictive modeling.
 * 
 * Features:
 * - Bayesian Inference: Prior/posterior updates, Beta-Binomial, Dirichlet-Multinomial
 * - Probability Distributions: Beta, Dirichlet, Normal, Poisson, Exponential
 * - Monte Carlo: MCMC sampling, bootstrap confidence intervals
 * - Predictive Models: Markov chains, Hidden Markov Models, Bayesian forecasting
 * - Hypothesis Testing: Bayesian A/B testing, Bayes factors
 * - Information Theory: Mutual information, conditional entropy
 * 
 * @module algorithms/BayesianStatistics
 */

// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log-gamma function (Stirling approximation for large x)
 */
export function logGamma(x: number): number {
  if (x <= 0) return Infinity
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  
  // Stirling approximation for x >= 0.5
  x -= 1
  const coeffs = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953
  ]
  
  let sum = 1.000000000190015
  for (let i = 0; i < coeffs.length; i++) {
    sum += coeffs[i] / (x + i + 1)
  }
  
  const tmp = x + 5.5
  return Math.log(Math.sqrt(2 * Math.PI) * sum / (x + 1)) + (x + 0.5) * Math.log(tmp) - tmp
}

/**
 * Gamma function
 */
export function gamma(x: number): number {
  return Math.exp(logGamma(x))
}

/**
 * Beta function B(a, b) = Γ(a)Γ(b) / Γ(a+b)
 */
export function betaFunction(a: number, b: number): number {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b))
}

/**
 * Log-beta function
 */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

/**
 * Factorial (with memoization)
 */
const factorialCache = new Map<number, number>([[0, 1], [1, 1]])
export function factorial(n: number): number {
  if (n < 0) return NaN
  if (n > 170) return Infinity
  if (factorialCache.has(n)) return factorialCache.get(n)!
  
  let result = factorialCache.get(Math.floor(n / 2) * 2) ?? 1
  for (let i = Math.floor(n / 2) * 2 + 1; i <= n; i++) {
    result *= i
    factorialCache.set(i, result)
  }
  return result
}

/**
 * Binomial coefficient C(n, k)
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  if (k > n - k) k = n - k
  
  let result = 1
  for (let i = 0; i < k; i++) {
    result *= (n - i) / (i + 1)
  }
  return Math.round(result)
}

/**
 * Error function approximation (Horner's method)
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  
  return sign * y
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBABILITY DISTRIBUTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Beta distribution
 */
export class BetaDistribution {
  constructor(
    public readonly alpha: number,
    public readonly beta: number
  ) {
    if (alpha <= 0 || beta <= 0) {
      throw new Error('Alpha and beta must be positive')
    }
  }

  /** Probability density function */
  pdf(x: number): number {
    if (x < 0 || x > 1) return 0
    if (x === 0 && this.alpha < 1) return Infinity
    if (x === 1 && this.beta < 1) return Infinity
    
    return (
      Math.pow(x, this.alpha - 1) *
      Math.pow(1 - x, this.beta - 1) /
      betaFunction(this.alpha, this.beta)
    )
  }

  /** Cumulative distribution function (regularized incomplete beta) */
  cdf(x: number): number {
    if (x <= 0) return 0
    if (x >= 1) return 1
    
    // Numerical integration using Simpson's rule
    const n = 1000
    const h = x / n
    let sum = this.pdf(0) + this.pdf(x)
    
    for (let i = 1; i < n; i++) {
      const xi = i * h
      sum += (i % 2 === 0 ? 2 : 4) * this.pdf(xi)
    }
    
    return (h / 3) * sum * betaFunction(this.alpha, this.beta)
  }

  /** Mean */
  mean(): number {
    return this.alpha / (this.alpha + this.beta)
  }

  /** Variance */
  variance(): number {
    const ab = this.alpha + this.beta
    return (this.alpha * this.beta) / (ab * ab * (ab + 1))
  }

  /** Mode (for α > 1, β > 1) */
  mode(): number {
    if (this.alpha <= 1 || this.beta <= 1) return NaN
    return (this.alpha - 1) / (this.alpha + this.beta - 2)
  }

  /** Sample using inverse transform */
  sample(rng: () => number = Math.random): number {
    // Box-Muller-like method for beta
    const u1 = this.sampleGamma(this.alpha, rng)
    const u2 = this.sampleGamma(this.beta, rng)
    return u1 / (u1 + u2)
  }

  private sampleGamma(shape: number, rng: () => number): number {
    // Marsaglia and Tsang's method
    if (shape < 1) {
      return this.sampleGamma(shape + 1, rng) * Math.pow(rng(), 1 / shape)
    }
    
    const d = shape - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    
    while (true) {
      let x: number, v: number
      do {
        // Generate normal using Box-Muller
        const u1 = rng()
        const u2 = rng()
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        v = 1 + c * x
      } while (v <= 0)
      
      v = v * v * v
      const u = rng()
      
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }

  /** Update with new observations (conjugate prior for Bernoulli) */
  update(successes: number, failures: number): BetaDistribution {
    return new BetaDistribution(
      this.alpha + successes,
      this.beta + failures
    )
  }

  /** Credible interval */
  credibleInterval(confidence: number = 0.95): [number, number] {
    const alpha = (1 - confidence) / 2
    
    // Binary search for quantiles
    const findQuantile = (p: number): number => {
      let low = 0, high = 1
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2
        if (this.cdf(mid) < p) low = mid
        else high = mid
      }
      return (low + high) / 2
    }
    
    return [findQuantile(alpha), findQuantile(1 - alpha)]
  }
}

/**
 * Dirichlet distribution (multivariate generalization of Beta)
 */
export class DirichletDistribution {
  constructor(public readonly alphas: number[]) {
    if (alphas.some(a => a <= 0)) {
      throw new Error('All alphas must be positive')
    }
  }

  /** Number of dimensions */
  get k(): number {
    return this.alphas.length
  }

  /** Sum of alphas */
  get alpha0(): number {
    return this.alphas.reduce((a, b) => a + b, 0)
  }

  /** Mean for each dimension */
  mean(): number[] {
    const sum = this.alpha0
    return this.alphas.map(a => a / sum)
  }

  /** Variance for each dimension */
  variance(): number[] {
    const sum = this.alpha0
    const denom = sum * sum * (sum + 1)
    return this.alphas.map(a => (a * (sum - a)) / denom)
  }

  /** Sample from the distribution */
  sample(rng: () => number = Math.random): number[] {
    const gammas = this.alphas.map(alpha => {
      // Sample gamma for each dimension
      const beta = new BetaDistribution(alpha, 1)
      return beta['sampleGamma'](alpha, rng)
    })
    
    const sum = gammas.reduce((a, b) => a + b, 0)
    return gammas.map(g => g / sum)
  }

  /** Update with observations (conjugate prior for Multinomial) */
  update(counts: number[]): DirichletDistribution {
    if (counts.length !== this.k) {
      throw new Error('Counts must match dimensions')
    }
    return new DirichletDistribution(
      this.alphas.map((a, i) => a + counts[i])
    )
  }

  /** Marginal for one dimension is Beta */
  marginal(dim: number): BetaDistribution {
    const alpha = this.alphas[dim]
    const beta = this.alpha0 - alpha
    return new BetaDistribution(alpha, beta)
  }
}

/**
 * Normal distribution
 */
export class NormalDistribution {
  constructor(
    public readonly mu: number = 0,
    public readonly sigma: number = 1
  ) {
    if (sigma <= 0) throw new Error('Sigma must be positive')
  }

  pdf(x: number): number {
    const z = (x - this.mu) / this.sigma
    return Math.exp(-0.5 * z * z) / (this.sigma * Math.sqrt(2 * Math.PI))
  }

  cdf(x: number): number {
    const z = (x - this.mu) / (this.sigma * Math.SQRT2)
    return 0.5 * (1 + erf(z))
  }

  sample(rng: () => number = Math.random): number {
    // Box-Muller transform
    const u1 = rng()
    const u2 = rng()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return this.mu + this.sigma * z
  }

  quantile(p: number): number {
    // Inverse CDF approximation
    if (p <= 0) return -Infinity
    if (p >= 1) return Infinity
    
    // Rational approximation
    const a = [
      -3.969683028665376e+01,
      2.209460984245205e+02,
      -2.759285104469687e+02,
      1.383577518672690e+02,
      -3.066479806614716e+01,
      2.506628277459239e+00
    ]
    const b = [
      -5.447609879822406e+01,
      1.615858368580409e+02,
      -1.556989798598866e+02,
      6.680131188771972e+01,
      -1.328068155288572e+01
    ]
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
      4.374664141464968e+00,
      2.938163982698783e+00
    ]
    const d = [
      7.784695709041462e-03,
      3.224671290700398e-01,
      2.445134137142996e+00,
      3.754408661907416e+00
    ]
    
    const pLow = 0.02425
    const pHigh = 1 - pLow
    
    let q: number
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p))
      return this.mu + this.sigma * (
        ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
      ) / (
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1
      )
    } else if (p <= pHigh) {
      q = p - 0.5
      const r = q * q
      return this.mu + this.sigma * (
        ((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]
      ) * q / (
        ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1
      )
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p))
      return this.mu + this.sigma * -(
        ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
      ) / (
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1
      )
    }
  }
}

/**
 * Poisson distribution
 */
export class PoissonDistribution {
  constructor(public readonly lambda: number) {
    if (lambda <= 0) throw new Error('Lambda must be positive')
  }

  pmf(k: number): number {
    if (k < 0 || !Number.isInteger(k)) return 0
    return Math.exp(k * Math.log(this.lambda) - this.lambda - logGamma(k + 1))
  }

  cdf(k: number): number {
    let sum = 0
    for (let i = 0; i <= Math.floor(k); i++) {
      sum += this.pmf(i)
    }
    return sum
  }

  sample(rng: () => number = Math.random): number {
    // Knuth algorithm for small lambda, rejection for large
    if (this.lambda < 30) {
      const L = Math.exp(-this.lambda)
      let k = 0
      let p = 1
      
      do {
        k++
        p *= rng()
      } while (p > L)
      
      return k - 1
    } else {
      // Normal approximation for large lambda
      const normal = new NormalDistribution(this.lambda, Math.sqrt(this.lambda))
      return Math.max(0, Math.round(normal.sample(rng)))
    }
  }

  mean(): number {
    return this.lambda
  }

  variance(): number {
    return this.lambda
  }
}

/**
 * Exponential distribution
 */
export class ExponentialDistribution {
  constructor(public readonly lambda: number) {
    if (lambda <= 0) throw new Error('Lambda must be positive')
  }

  pdf(x: number): number {
    if (x < 0) return 0
    return this.lambda * Math.exp(-this.lambda * x)
  }

  cdf(x: number): number {
    if (x < 0) return 0
    return 1 - Math.exp(-this.lambda * x)
  }

  sample(rng: () => number = Math.random): number {
    return -Math.log(rng()) / this.lambda
  }

  mean(): number {
    return 1 / this.lambda
  }

  variance(): number {
    return 1 / (this.lambda * this.lambda)
  }

  /** Memoryless property: P(X > s + t | X > s) = P(X > t) */
  survivalProbability(t: number): number {
    return Math.exp(-this.lambda * t)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAYESIAN INFERENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bayesian A/B testing result
 */
export interface BayesianABResult {
  /** P(A > B) */
  probabilityABetter: number
  /** P(B > A) */
  probabilityBBetter: number
  /** Expected loss if choosing A */
  expectedLossA: number
  /** Expected loss if choosing B */
  expectedLossB: number
  /** Posterior for A */
  posteriorA: BetaDistribution
  /** Posterior for B */
  posteriorB: BetaDistribution
  /** Credible intervals */
  credibleIntervalA: [number, number]
  credibleIntervalB: [number, number]
  /** Recommended choice */
  recommendation: 'A' | 'B' | 'need_more_data'
  /** Confidence in recommendation */
  confidence: number
}

/**
 * Bayesian A/B test
 */
export function bayesianABTest(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number,
  priorAlpha: number = 1,
  priorBeta: number = 1,
  samples: number = 10000
): BayesianABResult {
  const posteriorA = new BetaDistribution(
    priorAlpha + successesA,
    priorBeta + trialsA - successesA
  )
  
  const posteriorB = new BetaDistribution(
    priorAlpha + successesB,
    priorBeta + trialsB - successesB
  )
  
  // Monte Carlo simulation
  let aWins = 0
  let bWins = 0
  let lossA = 0
  let lossB = 0
  
  for (let i = 0; i < samples; i++) {
    const sampleA = posteriorA.sample()
    const sampleB = posteriorB.sample()
    
    if (sampleA > sampleB) {
      aWins++
      lossB += sampleA - sampleB
    } else {
      bWins++
      lossA += sampleB - sampleA
    }
  }
  
  const probabilityABetter = aWins / samples
  const probabilityBBetter = bWins / samples
  const expectedLossA = lossA / samples
  const expectedLossB = lossB / samples
  
  // Recommendation
  let recommendation: 'A' | 'B' | 'need_more_data'
  let confidence: number
  
  if (probabilityABetter > 0.95) {
    recommendation = 'A'
    confidence = probabilityABetter
  } else if (probabilityBBetter > 0.95) {
    recommendation = 'B'
    confidence = probabilityBBetter
  } else {
    recommendation = 'need_more_data'
    confidence = Math.max(probabilityABetter, probabilityBBetter)
  }
  
  return {
    probabilityABetter,
    probabilityBBetter,
    expectedLossA,
    expectedLossB,
    posteriorA,
    posteriorB,
    credibleIntervalA: posteriorA.credibleInterval(0.95),
    credibleIntervalB: posteriorB.credibleInterval(0.95),
    recommendation,
    confidence
  }
}

/**
 * Bayes factor for model comparison
 * BF > 3: substantial evidence
 * BF > 10: strong evidence
 * BF > 30: very strong evidence
 * BF > 100: decisive evidence
 */
export function bayesFactor(
  likelihoodH1: number,
  likelihoodH0: number,
  priorOdds: number = 1
): {
  bayesFactor: number
  posteriorOdds: number
  interpretation: string
} {
  const bf = likelihoodH1 / likelihoodH0
  const posteriorOdds = bf * priorOdds
  
  let interpretation: string
  if (bf < 1/30) interpretation = 'Very strong evidence for H0'
  else if (bf < 1/10) interpretation = 'Strong evidence for H0'
  else if (bf < 1/3) interpretation = 'Substantial evidence for H0'
  else if (bf < 3) interpretation = 'No substantial evidence either way'
  else if (bf < 10) interpretation = 'Substantial evidence for H1'
  else if (bf < 30) interpretation = 'Strong evidence for H1'
  else interpretation = 'Very strong evidence for H1'
  
  return { bayesFactor: bf, posteriorOdds, interpretation }
}

/**
 * Maximum A Posteriori (MAP) estimation
 */
export function mapEstimate(
  data: number[],
  priorMean: number,
  priorVariance: number,
  likelihoodVariance: number
): { map: number; posteriorVariance: number } {
  const n = data.length
  const dataMean = data.reduce((a, b) => a + b, 0) / n
  
  const posteriorVariance = 1 / (1 / priorVariance + n / likelihoodVariance)
  const map = posteriorVariance * (priorMean / priorVariance + n * dataMean / likelihoodVariance)
  
  return { map, posteriorVariance }
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKOV CHAINS & PREDICTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Markov chain transition matrix
 */
export class MarkovChain {
  private transitionMatrix: number[][]
  private states: number
  
  constructor(numStates: number) {
    this.states = numStates
    this.transitionMatrix = Array(numStates).fill(null).map(() =>
      Array(numStates).fill(0)
    )
  }
  
  /** Add observed transition */
  addTransition(fromState: number, toState: number, count: number = 1): void {
    this.transitionMatrix[fromState][toState] += count
  }
  
  /** Normalize to probabilities */
  normalize(): void {
    for (let i = 0; i < this.states; i++) {
      const sum = this.transitionMatrix[i].reduce((a, b) => a + b, 0)
      if (sum > 0) {
        for (let j = 0; j < this.states; j++) {
          this.transitionMatrix[i][j] /= sum
        }
      }
    }
  }
  
  /** Get transition probability */
  probability(fromState: number, toState: number): number {
    return this.transitionMatrix[fromState][toState]
  }
  
  /** Get next state probabilities */
  nextStateProbabilities(currentState: number): number[] {
    return [...this.transitionMatrix[currentState]]
  }
  
  /** Sample next state */
  sampleNext(currentState: number, rng: () => number = Math.random): number {
    const probs = this.transitionMatrix[currentState]
    const u = rng()
    let cumulative = 0
    
    for (let i = 0; i < this.states; i++) {
      cumulative += probs[i]
      if (u <= cumulative) return i
    }
    
    return this.states - 1
  }
  
  /** Compute stationary distribution (eigenvector for eigenvalue 1) */
  stationaryDistribution(iterations: number = 1000): number[] {
    // Power iteration
    let dist = Array(this.states).fill(1 / this.states)
    
    for (let iter = 0; iter < iterations; iter++) {
      const newDist = Array(this.states).fill(0)
      
      for (let j = 0; j < this.states; j++) {
        for (let i = 0; i < this.states; i++) {
          newDist[j] += dist[i] * this.transitionMatrix[i][j]
        }
      }
      
      dist = newDist
    }
    
    return dist
  }
  
  /** Expected first passage time */
  expectedFirstPassageTime(fromState: number, toState: number): number {
    if (fromState === toState) return 0
    
    // Use fundamental matrix calculation
    const pi = this.stationaryDistribution()
    if (pi[toState] === 0) return Infinity
    
    return 1 / pi[toState]
  }
  
  /** Generate sequence */
  generateSequence(startState: number, length: number, rng: () => number = Math.random): number[] {
    const sequence = [startState]
    let current = startState
    
    for (let i = 1; i < length; i++) {
      current = this.sampleNext(current, rng)
      sequence.push(current)
    }
    
    return sequence
  }
  
  /** Predict n steps ahead */
  predictAhead(currentState: number, steps: number): number[] {
    let probs = Array(this.states).fill(0)
    probs[currentState] = 1
    
    for (let step = 0; step < steps; step++) {
      const newProbs = Array(this.states).fill(0)
      
      for (let i = 0; i < this.states; i++) {
        for (let j = 0; j < this.states; j++) {
          newProbs[j] += probs[i] * this.transitionMatrix[i][j]
        }
      }
      
      probs = newProbs
    }
    
    return probs
  }
}

/**
 * Learn Markov chain from sequence
 */
export function learnMarkovChain(sequence: number[], numStates?: number): MarkovChain {
  const maxState = numStates ?? Math.max(...sequence) + 1
  const chain = new MarkovChain(maxState)
  
  for (let i = 0; i < sequence.length - 1; i++) {
    chain.addTransition(sequence[i], sequence[i + 1])
  }
  
  chain.normalize()
  return chain
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTE CARLO METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap confidence interval
 */
export function bootstrapConfidenceInterval(
  data: number[],
  statistic: (sample: number[]) => number,
  confidence: number = 0.95,
  numSamples: number = 1000,
  rng: () => number = Math.random
): {
  estimate: number
  lower: number
  upper: number
  standardError: number
} {
  const n = data.length
  const samples: number[] = []
  
  for (let i = 0; i < numSamples; i++) {
    // Resample with replacement
    const resample = Array(n).fill(0).map(() => data[Math.floor(rng() * n)])
    samples.push(statistic(resample))
  }
  
  samples.sort((a, b) => a - b)
  
  const alpha = (1 - confidence) / 2
  const lowerIdx = Math.floor(alpha * numSamples)
  const upperIdx = Math.floor((1 - alpha) * numSamples)
  
  const mean = samples.reduce((a, b) => a + b, 0) / numSamples
  const variance = samples.reduce((sum, s) => sum + (s - mean) ** 2, 0) / numSamples
  
  return {
    estimate: statistic(data),
    lower: samples[lowerIdx],
    upper: samples[upperIdx],
    standardError: Math.sqrt(variance)
  }
}

/**
 * Monte Carlo integration
 */
export function monteCarloIntegrate(
  f: (x: number[]) => number,
  lowerBounds: number[],
  upperBounds: number[],
  numSamples: number = 10000,
  rng: () => number = Math.random
): { estimate: number; standardError: number } {
  const dims = lowerBounds.length
  const volume = lowerBounds.reduce((vol, low, i) => vol * (upperBounds[i] - low), 1)
  
  let sum = 0
  let sumSq = 0
  
  for (let i = 0; i < numSamples; i++) {
    const point = lowerBounds.map((low, j) => low + rng() * (upperBounds[j] - low))
    const value = f(point)
    sum += value
    sumSq += value * value
  }
  
  const mean = sum / numSamples
  const variance = (sumSq / numSamples - mean * mean) / (numSamples - 1)
  
  return {
    estimate: volume * mean,
    standardError: volume * Math.sqrt(variance)
  }
}

/**
 * Importance sampling
 */
export function importanceSampling(
  targetDensity: (x: number) => number,
  proposalSampler: (rng: () => number) => number,
  proposalDensity: (x: number) => number,
  numSamples: number = 10000,
  rng: () => number = Math.random
): { samples: number[]; weights: number[]; effectiveSampleSize: number } {
  const samples: number[] = []
  const weights: number[] = []
  
  for (let i = 0; i < numSamples; i++) {
    const sample = proposalSampler(rng)
    const weight = targetDensity(sample) / proposalDensity(sample)
    samples.push(sample)
    weights.push(weight)
  }
  
  // Normalize weights
  const sumWeights = weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sumWeights
  }
  
  // Effective sample size
  const sumSqWeights = weights.reduce((a, w) => a + w * w, 0)
  const effectiveSampleSize = 1 / sumSqWeights
  
  return { samples, weights, effectiveSampleSize }
}

// ═══════════════════════════════════════════════════════════════════════════
// INFORMATION THEORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mutual information I(X; Y)
 */
export function mutualInformation(
  jointProbs: number[][],
  marginalX?: number[],
  marginalY?: number[]
): number {
  const rows = jointProbs.length
  const cols = jointProbs[0]?.length ?? 0
  
  // Compute marginals if not provided
  const pX = marginalX ?? jointProbs.map(row => row.reduce((a, b) => a + b, 0))
  const pY = marginalY ?? Array(cols).fill(0).map((_, j) =>
    jointProbs.reduce((sum, row) => sum + row[j], 0)
  )
  
  let mi = 0
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const pxy = jointProbs[i][j]
      if (pxy > 0 && pX[i] > 0 && pY[j] > 0) {
        mi += pxy * Math.log(pxy / (pX[i] * pY[j]))
      }
    }
  }
  
  return mi
}

/**
 * Conditional entropy H(Y|X)
 */
export function conditionalEntropy(jointProbs: number[][]): number {
  const rows = jointProbs.length
  const cols = jointProbs[0]?.length ?? 0
  
  // Marginal of X
  const pX = jointProbs.map(row => row.reduce((a, b) => a + b, 0))
  
  let ce = 0
  for (let i = 0; i < rows; i++) {
    if (pX[i] === 0) continue
    
    for (let j = 0; j < cols; j++) {
      const pxy = jointProbs[i][j]
      if (pxy > 0) {
        const pYgivenX = pxy / pX[i]
        ce -= pxy * Math.log(pYgivenX)
      }
    }
  }
  
  return ce
}

/**
 * Normalized mutual information
 */
export function normalizedMutualInformation(jointProbs: number[][]): number {
  const mi = mutualInformation(jointProbs)
  
  const pX = jointProbs.map(row => row.reduce((a, b) => a + b, 0))
  const pY = Array(jointProbs[0]?.length ?? 0).fill(0).map((_, j) =>
    jointProbs.reduce((sum, row) => sum + row[j], 0)
  )
  
  // Entropy of X
  const hX = pX.filter(p => p > 0).reduce((h, p) => h - p * Math.log(p), 0)
  // Entropy of Y
  const hY = pY.filter(p => p > 0).reduce((h, p) => h - p * Math.log(p), 0)
  
  if (hX === 0 || hY === 0) return 0
  
  return 2 * mi / (hX + hY)
}

// ═══════════════════════════════════════════════════════════════════════════
// TERRITORY-SPECIFIC BAYESIAN ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bayesian territory win probability
 */
export function bayesianWinProbability(
  territoryHistory: Map<number, number[]>,
  samples: number = 5000
): Map<number, { probability: number; credibleInterval: [number, number] }> {
  const results = new Map<number, { probability: number; credibleInterval: [number, number] }>()
  const players = Array.from(territoryHistory.keys())
  
  if (players.length < 2) {
    for (const player of players) {
      results.set(player, { probability: 1, credibleInterval: [1, 1] })
    }
    return results
  }
  
  // Fit Dirichlet to current shares
  const currentShares = players.map(p => {
    const history = territoryHistory.get(p)!
    return history[history.length - 1] ?? 0
  })
  
  const total = currentShares.reduce((a, b) => a + b, 0)
  if (total === 0) {
    for (const player of players) {
      results.set(player, { probability: 1 / players.length, credibleInterval: [0, 1] })
    }
    return results
  }
  
  // Use current shares + 1 as Dirichlet alphas (add 1 for smoothing)
  const alphas = currentShares.map(s => (s / total) * 10 + 1)
  const dirichlet = new DirichletDistribution(alphas)
  
  // Monte Carlo simulation
  const wins = players.map(() => 0)
  const sampleValues: number[][] = players.map(() => [])
  
  for (let i = 0; i < samples; i++) {
    const shares = dirichlet.sample()
    let maxIdx = 0
    let maxVal = shares[0]
    
    for (let j = 0; j < shares.length; j++) {
      sampleValues[j].push(shares[j])
      if (shares[j] > maxVal) {
        maxVal = shares[j]
        maxIdx = j
      }
    }
    
    wins[maxIdx]++
  }
  
  // Compute probabilities and credible intervals
  for (let i = 0; i < players.length; i++) {
    const probability = wins[i] / samples
    
    const sorted = sampleValues[i].sort((a, b) => a - b)
    const lower = sorted[Math.floor(0.025 * samples)]
    const upper = sorted[Math.floor(0.975 * samples)]
    
    results.set(players[i], {
      probability,
      credibleInterval: [lower, upper]
    })
  }
  
  return results
}

/**
 * Bayesian conquest rate estimation
 */
export function bayesianConquestRate(
  conquests: number,
  opportunities: number,
  priorAlpha: number = 1,
  priorBeta: number = 1
): {
  posterior: BetaDistribution
  pointEstimate: number
  credibleInterval: [number, number]
  probabilityAbove: (threshold: number) => number
} {
  const posterior = new BetaDistribution(
    priorAlpha + conquests,
    priorBeta + opportunities - conquests
  )
  
  return {
    posterior,
    pointEstimate: posterior.mean(),
    credibleInterval: posterior.credibleInterval(0.95),
    probabilityAbove: (threshold: number) => 1 - posterior.cdf(threshold)
  }
}

/**
 * Bayesian changepoint detection
 */
export function bayesianChangepoint(
  data: number[],
  priorMean: number = 0,
  priorPrecision: number = 0.1
): {
  mostLikelyChangepoint: number
  logOdds: number[]
  posteriorProbabilities: number[]
} {
  const n = data.length
  const logOdds: number[] = []
  
  // Compare model with changepoint vs without
  const globalMean = data.reduce((a, b) => a + b, 0) / n
  const globalVariance = data.reduce((sum, x) => sum + (x - globalMean) ** 2, 0) / n
  const noChangepointLogLik = -n / 2 * Math.log(2 * Math.PI * globalVariance) 
    - data.reduce((sum, x) => sum + (x - globalMean) ** 2, 0) / (2 * globalVariance)
  
  for (let t = 2; t < n - 2; t++) {
    const left = data.slice(0, t)
    const right = data.slice(t)
    
    const leftMean = left.reduce((a, b) => a + b, 0) / left.length
    const rightMean = right.reduce((a, b) => a + b, 0) / right.length
    
    const leftVar = Math.max(0.001, left.reduce((sum, x) => sum + (x - leftMean) ** 2, 0) / left.length)
    const rightVar = Math.max(0.001, right.reduce((sum, x) => sum + (x - rightMean) ** 2, 0) / right.length)
    
    const leftLogLik = -left.length / 2 * Math.log(2 * Math.PI * leftVar)
      - left.reduce((sum, x) => sum + (x - leftMean) ** 2, 0) / (2 * leftVar)
    
    const rightLogLik = -right.length / 2 * Math.log(2 * Math.PI * rightVar)
      - right.reduce((sum, x) => sum + (x - rightMean) ** 2, 0) / (2 * rightVar)
    
    const changepointLogLik = leftLogLik + rightLogLik
    logOdds.push(changepointLogLik - noChangepointLogLik)
  }
  
  // Convert to posterior probabilities
  const maxLogOdd = Math.max(...logOdds)
  const expOdds = logOdds.map(lo => Math.exp(lo - maxLogOdd))
  const sumExp = expOdds.reduce((a, b) => a + b, 0)
  const posteriorProbabilities = expOdds.map(e => e / sumExp)
  
  // Find most likely changepoint
  let maxProb = 0
  let mostLikelyChangepoint = 0
  for (let i = 0; i < posteriorProbabilities.length; i++) {
    if (posteriorProbabilities[i] > maxProb) {
      maxProb = posteriorProbabilities[i]
      mostLikelyChangepoint = i + 2 // offset by 2 since we started at t=2
    }
  }
  
  return {
    mostLikelyChangepoint,
    logOdds,
    posteriorProbabilities
  }
}

/**
 * Hidden Markov Model for territory state estimation
 */
export class HiddenMarkovModel {
  private transitions: number[][]
  private emissions: number[][]
  private initial: number[]
  
  constructor(
    public readonly numStates: number,
    public readonly numObservations: number
  ) {
    // Initialize with random probabilities
    this.transitions = Array(numStates).fill(null).map(() =>
      Array(numStates).fill(1 / numStates)
    )
    this.emissions = Array(numStates).fill(null).map(() =>
      Array(numObservations).fill(1 / numObservations)
    )
    this.initial = Array(numStates).fill(1 / numStates)
  }
  
  /** Forward algorithm */
  forward(observations: number[]): number[][] {
    const T = observations.length
    const alpha: number[][] = Array(T).fill(null).map(() => Array(this.numStates).fill(0))
    
    // Initialization
    for (let i = 0; i < this.numStates; i++) {
      alpha[0][i] = this.initial[i] * this.emissions[i][observations[0]]
    }
    
    // Induction
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < this.numStates; j++) {
        let sum = 0
        for (let i = 0; i < this.numStates; i++) {
          sum += alpha[t - 1][i] * this.transitions[i][j]
        }
        alpha[t][j] = sum * this.emissions[j][observations[t]]
      }
    }
    
    return alpha
  }
  
  /** Backward algorithm */
  backward(observations: number[]): number[][] {
    const T = observations.length
    const beta: number[][] = Array(T).fill(null).map(() => Array(this.numStates).fill(0))
    
    // Initialization
    for (let i = 0; i < this.numStates; i++) {
      beta[T - 1][i] = 1
    }
    
    // Induction
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < this.numStates; i++) {
        let sum = 0
        for (let j = 0; j < this.numStates; j++) {
          sum += this.transitions[i][j] * this.emissions[j][observations[t + 1]] * beta[t + 1][j]
        }
        beta[t][i] = sum
      }
    }
    
    return beta
  }
  
  /** Viterbi algorithm for most likely state sequence */
  viterbi(observations: number[]): { path: number[]; probability: number } {
    const T = observations.length
    const vit: number[][] = Array(T).fill(null).map(() => Array(this.numStates).fill(0))
    const backpointer: number[][] = Array(T).fill(null).map(() => Array(this.numStates).fill(0))
    
    // Initialization
    for (let i = 0; i < this.numStates; i++) {
      vit[0][i] = Math.log(this.initial[i]) + Math.log(this.emissions[i][observations[0]])
      backpointer[0][i] = 0
    }
    
    // Recursion
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < this.numStates; j++) {
        let maxProb = -Infinity
        let bestPrev = 0
        
        for (let i = 0; i < this.numStates; i++) {
          const prob = vit[t - 1][i] + Math.log(this.transitions[i][j])
          if (prob > maxProb) {
            maxProb = prob
            bestPrev = i
          }
        }
        
        vit[t][j] = maxProb + Math.log(this.emissions[j][observations[t]])
        backpointer[t][j] = bestPrev
      }
    }
    
    // Termination
    let maxProb = -Infinity
    let lastState = 0
    for (let i = 0; i < this.numStates; i++) {
      if (vit[T - 1][i] > maxProb) {
        maxProb = vit[T - 1][i]
        lastState = i
      }
    }
    
    // Backtrace
    const path = [lastState]
    for (let t = T - 1; t > 0; t--) {
      lastState = backpointer[t][lastState]
      path.unshift(lastState)
    }
    
    return { path, probability: Math.exp(maxProb) }
  }
  
  /** Baum-Welch training */
  train(observations: number[], maxIterations: number = 100, tolerance: number = 1e-6): void {
    let prevLogLik = -Infinity
    
    for (let iter = 0; iter < maxIterations; iter++) {
      const alpha = this.forward(observations)
      const beta = this.backward(observations)
      
      const T = observations.length
      
      // Compute likelihood
      let logLik = 0
      for (let i = 0; i < this.numStates; i++) {
        logLik += alpha[T - 1][i]
      }
      logLik = Math.log(logLik)
      
      if (Math.abs(logLik - prevLogLik) < tolerance) break
      prevLogLik = logLik
      
      // E-step: compute gamma and xi
      const gamma: number[][] = []
      const xi: number[][][] = []
      
      for (let t = 0; t < T; t++) {
        gamma[t] = []
        let sum = 0
        
        for (let i = 0; i < this.numStates; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i]
          sum += gamma[t][i]
        }
        
        for (let i = 0; i < this.numStates; i++) {
          gamma[t][i] /= sum
        }
        
        if (t < T - 1) {
          xi[t] = Array(this.numStates).fill(null).map(() => Array(this.numStates).fill(0))
          let sumXi = 0
          
          for (let i = 0; i < this.numStates; i++) {
            for (let j = 0; j < this.numStates; j++) {
              xi[t][i][j] = alpha[t][i] * this.transitions[i][j] *
                this.emissions[j][observations[t + 1]] * beta[t + 1][j]
              sumXi += xi[t][i][j]
            }
          }
          
          for (let i = 0; i < this.numStates; i++) {
            for (let j = 0; j < this.numStates; j++) {
              xi[t][i][j] /= sumXi
            }
          }
        }
      }
      
      // M-step: update parameters
      // Update initial
      for (let i = 0; i < this.numStates; i++) {
        this.initial[i] = gamma[0][i]
      }
      
      // Update transitions
      for (let i = 0; i < this.numStates; i++) {
        let sumGamma = 0
        for (let t = 0; t < T - 1; t++) {
          sumGamma += gamma[t][i]
        }
        
        for (let j = 0; j < this.numStates; j++) {
          let sumXi = 0
          for (let t = 0; t < T - 1; t++) {
            sumXi += xi[t][i][j]
          }
          this.transitions[i][j] = sumGamma > 0 ? sumXi / sumGamma : 1 / this.numStates
        }
      }
      
      // Update emissions
      for (let i = 0; i < this.numStates; i++) {
        let sumGamma = 0
        for (let t = 0; t < T; t++) {
          sumGamma += gamma[t][i]
        }
        
        for (let k = 0; k < this.numObservations; k++) {
          let sumGammaObs = 0
          for (let t = 0; t < T; t++) {
            if (observations[t] === k) {
              sumGammaObs += gamma[t][i]
            }
          }
          this.emissions[i][k] = sumGamma > 0 ? sumGammaObs / sumGamma : 1 / this.numObservations
        }
      }
    }
  }
  
  /** Predict most likely next observation */
  predictNext(recentObservations: number[]): number[] {
    const alpha = this.forward(recentObservations)
    const T = recentObservations.length
    
    // State distribution at T
    const stateProbs = alpha[T - 1]
    const sum = stateProbs.reduce((a, b) => a + b, 0)
    const normalizedState = stateProbs.map(p => p / sum)
    
    // Predict state at T+1
    const nextStateProbs = Array(this.numStates).fill(0)
    for (let j = 0; j < this.numStates; j++) {
      for (let i = 0; i < this.numStates; i++) {
        nextStateProbs[j] += normalizedState[i] * this.transitions[i][j]
      }
    }
    
    // Predict observation probabilities
    const obsProbs = Array(this.numObservations).fill(0)
    for (let k = 0; k < this.numObservations; k++) {
      for (let j = 0; j < this.numStates; j++) {
        obsProbs[k] += nextStateProbs[j] * this.emissions[j][k]
      }
    }
    
    return obsProbs
  }
}

/**
 * Kalman filter for territory value prediction
 */
export class KalmanFilter {
  private state: number
  private covariance: number
  
  constructor(
    initialState: number,
    initialCovariance: number,
    private processNoise: number,
    private measurementNoise: number
  ) {
    this.state = initialState
    this.covariance = initialCovariance
  }
  
  /** Predict step */
  predict(control: number = 0): { state: number; covariance: number } {
    this.state = this.state + control
    this.covariance = this.covariance + this.processNoise
    
    return {
      state: this.state,
      covariance: this.covariance
    }
  }
  
  /** Update step */
  update(measurement: number): { state: number; covariance: number } {
    const kalmanGain = this.covariance / (this.covariance + this.measurementNoise)
    
    this.state = this.state + kalmanGain * (measurement - this.state)
    this.covariance = (1 - kalmanGain) * this.covariance
    
    return {
      state: this.state,
      covariance: this.covariance
    }
  }
  
  /** Full predict-update cycle */
  step(measurement: number, control: number = 0): { state: number; covariance: number } {
    this.predict(control)
    return this.update(measurement)
  }
  
  /** Get current state estimate */
  getState(): number {
    return this.state
  }
  
  /** Get current uncertainty */
  getUncertainty(): number {
    return Math.sqrt(this.covariance)
  }
  
  /** Forecast n steps ahead */
  forecast(steps: number): { predictions: number[]; uncertainties: number[] } {
    const predictions: number[] = []
    const uncertainties: number[] = []
    
    let forecastState = this.state
    let forecastCov = this.covariance
    
    for (let i = 0; i < steps; i++) {
      forecastCov += this.processNoise
      predictions.push(forecastState)
      uncertainties.push(Math.sqrt(forecastCov))
    }
    
    return { predictions, uncertainties }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE PROBABILITY SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════

export interface ProbabilitySnapshot {
  // Win probabilities per player
  winProbabilities: Map<number, number>
  winCredibleIntervals: Map<number, [number, number]>
  
  // Markov predictions
  markovNextState: Map<number, number[]>
  markovStationaryDistribution: number[]
  
  // Bayesian estimates
  bayesianConquestRates: Map<number, { rate: number; ci: [number, number] }>
  
  // Change detection
  changepoints: Map<number, number>
  changepointConfidence: Map<number, number>
  
  // Kalman predictions
  kalmanPredictions: Map<number, { value: number; uncertainty: number }[]>
  
  // Overall game state
  dominanceIndex: number  // 0 = balanced, 1 = dominated
  volatilityIndex: number // 0 = stable, 1 = chaotic
  predictability: number  // 0 = random, 1 = deterministic
  
  // Confidence in predictions
  overallConfidence: number
  
  // Time until predicted winner
  estimatedTurnsToVictory: number | null
}

/**
 * Generate comprehensive probability snapshot
 */
export function generateProbabilitySnapshot(
  territoryHistory: Map<number, number[]>,
  conquestCounts: Map<number, { successes: number; opportunities: number }>,
  options: {
    forecastSteps?: number
    samples?: number
  } = {}
): ProbabilitySnapshot {
  const { forecastSteps = 10, samples = 1000 } = options
  const players = Array.from(territoryHistory.keys())
  
  // Win probabilities
  const winResult = bayesianWinProbability(territoryHistory, samples)
  const winProbabilities = new Map<number, number>()
  const winCredibleIntervals = new Map<number, [number, number]>()
  
  for (const [player, data] of winResult) {
    winProbabilities.set(player, data.probability)
    winCredibleIntervals.set(player, data.credibleInterval)
  }
  
  // Markov predictions
  const markovNextState = new Map<number, number[]>()
  const allHistory: number[] = []
  
  for (const [player, history] of territoryHistory) {
    // Discretize history into states (quintiles)
    if (history.length > 5) {
      const sorted = [...history].sort((a, b) => a - b)
      const states = history.map(v => {
        const idx = sorted.indexOf(v)
        return Math.floor(idx / sorted.length * 5)
      })
      
      const chain = learnMarkovChain(states, 5)
      const lastState = states[states.length - 1]
      markovNextState.set(player, chain.predictAhead(lastState, forecastSteps))
    }
  }
  
  // Compute stationary distribution from overall game flow
  const overallChain = new MarkovChain(players.length)
  for (let t = 1; t < Math.min(...Array.from(territoryHistory.values()).map(h => h.length)); t++) {
    for (let i = 0; i < players.length; i++) {
      for (let j = 0; j < players.length; j++) {
        const histI = territoryHistory.get(players[i])!
        const histJ = territoryHistory.get(players[j])!
        
        // Transition if j gained relative to i
        if (histJ[t] > histJ[t - 1] && histI[t] < histI[t - 1]) {
          overallChain.addTransition(i, j)
        }
      }
    }
  }
  overallChain.normalize()
  const markovStationaryDistribution = overallChain.stationaryDistribution()
  
  // Bayesian conquest rates
  const bayesianConquestRates = new Map<number, { rate: number; ci: [number, number] }>()
  for (const [player, counts] of conquestCounts) {
    const result = bayesianConquestRate(counts.successes, counts.opportunities)
    bayesianConquestRates.set(player, {
      rate: result.pointEstimate,
      ci: result.credibleInterval
    })
  }
  
  // Changepoint detection
  const changepoints = new Map<number, number>()
  const changepointConfidence = new Map<number, number>()
  
  for (const [player, history] of territoryHistory) {
    if (history.length > 10) {
      const result = bayesianChangepoint(history)
      changepoints.set(player, result.mostLikelyChangepoint)
      
      const maxProb = Math.max(...result.posteriorProbabilities)
      changepointConfidence.set(player, maxProb)
    }
  }
  
  // Kalman predictions
  const kalmanPredictions = new Map<number, { value: number; uncertainty: number }[]>()
  
  for (const [player, history] of territoryHistory) {
    if (history.length > 3) {
      const initialValue = history[0]
      const variance = history.slice(1).reduce((sum, v, i) => 
        sum + (v - history[i]) ** 2, 0) / history.length
      
      const filter = new KalmanFilter(
        initialValue,
        variance,
        variance * 0.1,  // process noise
        variance * 0.5   // measurement noise
      )
      
      // Run through history
      for (const measurement of history) {
        filter.step(measurement)
      }
      
      // Forecast
      const { predictions, uncertainties } = filter.forecast(forecastSteps)
      kalmanPredictions.set(player, 
        predictions.map((v, i) => ({ value: v, uncertainty: uncertainties[i] }))
      )
    }
  }
  
  // Compute indices
  const currentTotals = players.map(p => {
    const h = territoryHistory.get(p)!
    return h[h.length - 1] ?? 0
  })
  const totalTerritory = currentTotals.reduce((a, b) => a + b, 0)
  const shares = currentTotals.map(t => t / totalTerritory || 0)
  
  // Dominance: HHI-like
  const dominanceIndex = shares.reduce((sum, s) => sum + s * s, 0)
  
  // Volatility: average coefficient of variation
  let totalCV = 0
  for (const [, history] of territoryHistory) {
    const mean = history.reduce((a, b) => a + b, 0) / history.length
    const std = Math.sqrt(history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length)
    totalCV += std / (mean || 1)
  }
  const volatilityIndex = Math.min(1, totalCV / players.length)
  
  // Predictability: based on Markov chain regularity
  const predictability = 1 - markovStationaryDistribution.reduce((sum, p) => 
    sum + (p > 0 ? -p * Math.log(p) : 0), 0) / Math.log(players.length || 2)
  
  // Overall confidence: average win probability of leader
  const maxWinProb = Math.max(...Array.from(winProbabilities.values()))
  const overallConfidence = maxWinProb
  
  // Estimated turns to victory
  let estimatedTurnsToVictory: number | null = null
  
  const winThreshold = 0.95 * totalTerritory
  for (const [player, predictions] of kalmanPredictions) {
    for (let t = 0; t < predictions.length; t++) {
      if (predictions[t].value >= winThreshold) {
        if (estimatedTurnsToVictory === null || t < estimatedTurnsToVictory) {
          estimatedTurnsToVictory = t + 1
        }
        break
      }
    }
  }
  
  return {
    winProbabilities,
    winCredibleIntervals,
    markovNextState,
    markovStationaryDistribution,
    bayesianConquestRates,
    changepoints,
    changepointConfidence,
    kalmanPredictions,
    dominanceIndex,
    volatilityIndex,
    predictability,
    overallConfidence,
    estimatedTurnsToVictory
  }
}
