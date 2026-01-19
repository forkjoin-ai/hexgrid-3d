//! Statistical computations for hexgrid analysis

use std::collections::HashMap;

/// Compute Gini coefficient for inequality measurement
pub fn gini_coefficient(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    
    let mut sorted: Vec<f64> = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    
    let n = sorted.len() as f64;
    let mut sum = 0.0;
    
    for (i, &val) in sorted.iter().enumerate() {
        sum += (2.0 * (i as f64 + 1.0) - n - 1.0) * val;
    }
    
    let mean: f64 = sorted.iter().sum::<f64>() / n;
    if mean == 0.0 {
        return 0.0;
    }
    
    sum / (n * n * mean)
}

/// Compute Shannon entropy
pub fn shannon_entropy(values: &[f64]) -> f64 {
    let total: f64 = values.iter().sum();
    if total == 0.0 {
        return 0.0;
    }
    
    let mut entropy = 0.0;
    for &val in values {
        if val > 0.0 {
            let p = val / total;
            entropy -= p * p.ln();
        }
    }
    
    entropy
}

/// Compute normalized Shannon entropy (0-1)
pub fn normalized_entropy(values: &[f64]) -> f64 {
    let n = values.len();
    if n <= 1 {
        return 0.0;
    }
    
    let entropy = shannon_entropy(values);
    let max_entropy = (n as f64).ln();
    
    if max_entropy == 0.0 {
        return 0.0;
    }
    
    entropy / max_entropy
}

/// Compute Theil index (generalized entropy)
pub fn theil_index(values: &[f64]) -> f64 {
    let n = values.len();
    if n == 0 {
        return 0.0;
    }
    
    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    if mean == 0.0 {
        return 0.0;
    }
    
    let mut theil = 0.0;
    for &val in values {
        if val > 0.0 {
            let ratio = val / mean;
            theil += ratio * ratio.ln();
        }
    }
    
    theil / n as f64
}

/// Compute Atkinson index
pub fn atkinson_index(values: &[f64], epsilon: f64) -> f64 {
    let n = values.len();
    if n == 0 {
        return 0.0;
    }
    
    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    if mean == 0.0 {
        return 0.0;
    }
    
    if (epsilon - 1.0).abs() < 0.0001 {
        // Special case: epsilon = 1 (uses geometric mean)
        let log_sum: f64 = values.iter()
            .filter(|&&v| v > 0.0)
            .map(|&v| v.ln())
            .sum();
        let geometric_mean = (log_sum / n as f64).exp();
        1.0 - geometric_mean / mean
    } else {
        let sum: f64 = values.iter()
            .map(|&v| (v / mean).powf(1.0 - epsilon))
            .sum();
        let power_mean = (sum / n as f64).powf(1.0 / (1.0 - epsilon));
        1.0 - power_mean
    }
}

/// Compute Pareto ratio (80/20 analysis)
pub fn pareto_ratio(values: &[f64], percentile: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    
    let mut sorted: Vec<f64> = values.to_vec();
    sorted.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    
    let total: f64 = sorted.iter().sum();
    if total == 0.0 {
        return 0.0;
    }
    
    let target = total * percentile;
    let mut cumulative = 0.0;
    let mut count = 0;
    
    for val in sorted {
        cumulative += val;
        count += 1;
        if cumulative >= target {
            break;
        }
    }
    
    count as f64 / values.len() as f64
}

/// Compute Zipf coefficient from territory distribution
pub fn zipf_coefficient(counts: &[usize]) -> f64 {
    if counts.len() < 2 {
        return 0.0;
    }
    
    let mut sorted: Vec<usize> = counts.to_vec();
    sorted.sort_by(|a, b| b.cmp(a));
    
    // Filter out zeros
    let non_zero: Vec<f64> = sorted.iter()
        .filter(|&&c| c > 0)
        .map(|&c| c as f64)
        .collect();
    
    if non_zero.len() < 2 {
        return 0.0;
    }
    
    // Linear regression on log-log scale
    let n = non_zero.len() as f64;
    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    let mut sum_xy = 0.0;
    let mut sum_xx = 0.0;
    
    for (i, &val) in non_zero.iter().enumerate() {
        let x = ((i + 1) as f64).ln();
        let y = val.ln();
        sum_x += x;
        sum_y += y;
        sum_xy += x * y;
        sum_xx += x * x;
    }
    
    // Slope of regression line
    let denominator = n * sum_xx - sum_x * sum_x;
    if denominator.abs() < 0.0001 {
        return 0.0;
    }
    
    -(n * sum_xy - sum_x * sum_y) / denominator
}

/// Compute Herfindahl-Hirschman Index (market concentration)
pub fn herfindahl_index(values: &[f64]) -> f64 {
    let total: f64 = values.iter().sum();
    if total == 0.0 {
        return 0.0;
    }
    
    values.iter()
        .map(|&v| {
            let share = v / total;
            share * share
        })
        .sum()
}

/// Compute coefficient of variation
pub fn coefficient_of_variation(values: &[f64]) -> f64 {
    let n = values.len();
    if n == 0 {
        return 0.0;
    }
    
    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    if mean == 0.0 {
        return 0.0;
    }
    
    let variance: f64 = values.iter()
        .map(|&v| (v - mean).powi(2))
        .sum::<f64>() / n as f64;
    
    variance.sqrt() / mean
}

/// Compute skewness (asymmetry measure)
pub fn skewness(values: &[f64]) -> f64 {
    let n = values.len();
    if n < 3 {
        return 0.0;
    }
    
    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    
    let variance: f64 = values.iter()
        .map(|&v| (v - mean).powi(2))
        .sum::<f64>() / n as f64;
    
    if variance == 0.0 {
        return 0.0;
    }
    
    let std_dev = variance.sqrt();
    
    let m3: f64 = values.iter()
        .map(|&v| ((v - mean) / std_dev).powi(3))
        .sum::<f64>() / n as f64;
    
    m3
}

/// Compute kurtosis (tail weight measure)
pub fn kurtosis(values: &[f64]) -> f64 {
    let n = values.len();
    if n < 4 {
        return 0.0;
    }
    
    let mean: f64 = values.iter().sum::<f64>() / n as f64;
    
    let variance: f64 = values.iter()
        .map(|&v| (v - mean).powi(2))
        .sum::<f64>() / n as f64;
    
    if variance == 0.0 {
        return 0.0;
    }
    
    let std_dev = variance.sqrt();
    
    let m4: f64 = values.iter()
        .map(|&v| ((v - mean) / std_dev).powi(4))
        .sum::<f64>() / n as f64;
    
    m4 - 3.0  // Excess kurtosis
}

/// Compute Kullback-Leibler divergence
pub fn kl_divergence(p: &[f64], q: &[f64]) -> f64 {
    if p.len() != q.len() || p.is_empty() {
        return 0.0;
    }
    
    let p_sum: f64 = p.iter().sum();
    let q_sum: f64 = q.iter().sum();
    
    if p_sum == 0.0 || q_sum == 0.0 {
        return 0.0;
    }
    
    let mut divergence = 0.0;
    for (i, &pi) in p.iter().enumerate() {
        if pi > 0.0 && q[i] > 0.0 {
            let p_norm = pi / p_sum;
            let q_norm = q[i] / q_sum;
            divergence += p_norm * (p_norm / q_norm).ln();
        }
    }
    
    divergence
}

/// Compute Jensen-Shannon divergence (symmetric)
pub fn js_divergence(p: &[f64], q: &[f64]) -> f64 {
    if p.len() != q.len() || p.is_empty() {
        return 0.0;
    }
    
    // Compute M = (P + Q) / 2
    let m: Vec<f64> = p.iter()
        .zip(q.iter())
        .map(|(&pi, &qi)| (pi + qi) / 2.0)
        .collect();
    
    (kl_divergence(p, &m) + kl_divergence(q, &m)) / 2.0
}

/// Compute running statistics (online algorithm)
pub struct RunningStats {
    count: usize,
    mean: f64,
    m2: f64,      // For variance
    m3: f64,      // For skewness
    m4: f64,      // For kurtosis
    min: f64,
    max: f64,
}

impl RunningStats {
    pub fn new() -> Self {
        Self {
            count: 0,
            mean: 0.0,
            m2: 0.0,
            m3: 0.0,
            m4: 0.0,
            min: f64::MAX,
            max: f64::MIN,
        }
    }

    pub fn push(&mut self, value: f64) {
        let n = self.count + 1;
        let delta = value - self.mean;
        let delta_n = delta / n as f64;
        let delta_n2 = delta_n * delta_n;
        let term1 = delta * delta_n * self.count as f64;

        self.mean += delta_n;
        self.m4 += term1 * delta_n2 * (n * n - 3 * n + 3) as f64
            + 6.0 * delta_n2 * self.m2
            - 4.0 * delta_n * self.m3;
        self.m3 += term1 * delta_n * (n - 2) as f64 - 3.0 * delta_n * self.m2;
        self.m2 += term1;
        
        self.count = n;
        self.min = self.min.min(value);
        self.max = self.max.max(value);
    }

    pub fn count(&self) -> usize { self.count }
    pub fn mean(&self) -> f64 { self.mean }
    pub fn min(&self) -> f64 { self.min }
    pub fn max(&self) -> f64 { self.max }

    pub fn variance(&self) -> f64 {
        if self.count < 2 {
            return 0.0;
        }
        self.m2 / self.count as f64
    }

    pub fn std_dev(&self) -> f64 {
        self.variance().sqrt()
    }

    pub fn skewness(&self) -> f64 {
        if self.count < 3 || self.m2 == 0.0 {
            return 0.0;
        }
        let n = self.count as f64;
        (n.sqrt() * self.m3) / self.m2.powf(1.5)
    }

    pub fn kurtosis(&self) -> f64 {
        if self.count < 4 || self.m2 == 0.0 {
            return 0.0;
        }
        let n = self.count as f64;
        (n * self.m4) / (self.m2 * self.m2) - 3.0
    }
}

impl Default for RunningStats {
    fn default() -> Self {
        Self::new()
    }
}

/// Exponential moving average
pub struct ExponentialMovingAverage {
    alpha: f64,
    value: Option<f64>,
}

impl ExponentialMovingAverage {
    pub fn new(alpha: f64) -> Self {
        Self {
            alpha: alpha.clamp(0.0, 1.0),
            value: None,
        }
    }

    pub fn from_period(period: usize) -> Self {
        let alpha = 2.0 / (period + 1) as f64;
        Self::new(alpha)
    }

    pub fn push(&mut self, value: f64) -> f64 {
        match self.value {
            None => {
                self.value = Some(value);
                value
            }
            Some(prev) => {
                let new_value = self.alpha * value + (1.0 - self.alpha) * prev;
                self.value = Some(new_value);
                new_value
            }
        }
    }

    pub fn current(&self) -> Option<f64> {
        self.value
    }

    pub fn reset(&mut self) {
        self.value = None;
    }
}

/// Histogram with fixed bins
pub struct Histogram {
    bins: Vec<usize>,
    min: f64,
    max: f64,
    bin_width: f64,
}

impl Histogram {
    pub fn new(min: f64, max: f64, num_bins: usize) -> Self {
        Self {
            bins: vec![0; num_bins],
            min,
            max,
            bin_width: (max - min) / num_bins as f64,
        }
    }

    pub fn add(&mut self, value: f64) {
        if value < self.min || value > self.max {
            return;
        }
        let bin = ((value - self.min) / self.bin_width) as usize;
        let bin = bin.min(self.bins.len() - 1);
        self.bins[bin] += 1;
    }

    pub fn get_bins(&self) -> &[usize] {
        &self.bins
    }

    pub fn normalize(&self) -> Vec<f64> {
        let total: usize = self.bins.iter().sum();
        if total == 0 {
            return vec![0.0; self.bins.len()];
        }
        self.bins.iter().map(|&c| c as f64 / total as f64).collect()
    }

    pub fn percentile(&self, p: f64) -> f64 {
        let total: usize = self.bins.iter().sum();
        if total == 0 {
            return self.min;
        }
        
        let target = (total as f64 * p) as usize;
        let mut cumulative = 0;
        
        for (i, &count) in self.bins.iter().enumerate() {
            cumulative += count;
            if cumulative >= target {
                return self.min + (i as f64 + 0.5) * self.bin_width;
            }
        }
        
        self.max
    }
}
