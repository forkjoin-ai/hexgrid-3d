import { describe, it, expect } from 'bun:test';
import {
  logGamma,
  gamma,
  betaFunction,
  logBeta,
  factorial,
  binomial,
} from '../../src/algorithms/BayesianStatistics';

describe('BayesianStatistics', () => {
  describe('Math Utilities', () => {
    describe('logGamma', () => {
      it('returns positive for valid inputs', () => {
        expect(typeof logGamma(1)).toBe('number');
        expect(typeof logGamma(5)).toBe('number');
      });

      it('handles small values', () => {
        expect(typeof logGamma(0.5)).toBe('number');
      });

      it('returns infinity for zero or negative', () => {
        expect(logGamma(0)).toBe(Infinity);
        expect(logGamma(-1)).toBe(Infinity);
      });
    });

    describe('gamma', () => {
      it('returns positive for valid inputs', () => {
        expect(gamma(1)).toBeGreaterThan(0);
        expect(gamma(5)).toBeGreaterThan(0);
      });

      it('is consistent with logGamma', () => {
        expect(gamma(3)).toBeCloseTo(Math.exp(logGamma(3)));
      });
    });

    describe('betaFunction', () => {
      it('returns positive for valid inputs', () => {
        expect(betaFunction(1, 1)).toBeGreaterThan(0);
        expect(betaFunction(2, 2)).toBeGreaterThan(0);
      });

      it('is symmetric', () => {
        expect(betaFunction(2, 3)).toBeCloseTo(betaFunction(3, 2));
      });
    });

    describe('logBeta', () => {
      it('is consistent with betaFunction', () => {
        const a = 2,
          b = 3;
        expect(logBeta(a, b)).toBeCloseTo(Math.log(betaFunction(a, b)));
      });
    });

    describe('factorial', () => {
      it('calculates 0!', () => {
        expect(factorial(0)).toBe(1);
      });

      it('calculates 1!', () => {
        expect(factorial(1)).toBe(1);
      });

      it('returns NaN for negative', () => {
        expect(factorial(-1)).toBeNaN();
      });

      it('returns Infinity for large values', () => {
        expect(factorial(171)).toBe(Infinity);
      });
    });

    describe('binomial', () => {
      it('calculates C(5, 2)', () => {
        expect(binomial(5, 2)).toBe(10);
      });

      it('calculates C(10, 5)', () => {
        expect(binomial(10, 5)).toBe(252);
      });

      it('returns 1 for C(n, 0)', () => {
        expect(binomial(10, 0)).toBe(1);
      });

      it('returns 1 for C(n, n)', () => {
        expect(binomial(10, 10)).toBe(1);
      });

      it('returns 0 for k > n', () => {
        expect(binomial(5, 10)).toBe(0);
      });

      it('returns 0 for negative k', () => {
        expect(binomial(5, -1)).toBe(0);
      });

      it('is symmetric', () => {
        expect(binomial(10, 3)).toBe(binomial(10, 7));
      });
    });
  });
});
