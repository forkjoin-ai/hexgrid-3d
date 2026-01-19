//! HexGrid WASM - High-Performance Hexagonal Grid Computations
//!
//! This crate provides WebAssembly bindings for computationally intensive
//! hexgrid operations, achieving significant speedups over pure JavaScript.
//!
//! # Features
//! - O(1) neighbor lookups with precomputed tables
//! - SIMD-accelerated vector operations (when available)
//! - Efficient spatial indexing
//! - Optimized infection simulation
//! - Flow field computation
//!
//! # Usage from JavaScript
//! ```javascript
//! import init, { HexGridWasm } from './hexgrid_wasm';
//! await init();
//! const grid = new HexGridWasm(100, 100);
//! grid.stepInfection();
//! ```

mod spatial;
mod math;
mod statistics;

use wasm_bindgen::prelude::*;
use std::collections::{HashMap, HashSet, VecDeque};
use rand::prelude::*;

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/// Axial hex coordinate
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Axial {
    pub q: i32,
    pub r: i32,
}

impl Axial {
    #[inline]
    pub fn new(q: i32, r: i32) -> Self {
        Self { q, r }
    }

    /// Get the 6 neighbors in axial coordinates
    #[inline]
    pub fn neighbors(&self) -> [Axial; 6] {
        const DIRECTIONS: [(i32, i32); 6] = [
            (1, 0), (1, -1), (0, -1),
            (-1, 0), (-1, 1), (0, 1),
        ];
        
        let mut result = [Axial::new(0, 0); 6];
        for (i, (dq, dr)) in DIRECTIONS.iter().enumerate() {
            result[i] = Axial::new(self.q + dq, self.r + dr);
        }
        result
    }

    /// Distance to another hex
    #[inline]
    pub fn distance(&self, other: &Axial) -> i32 {
        let dq = self.q - other.q;
        let dr = self.r - other.r;
        let ds = -dq - dr;
        (dq.abs() + dr.abs() + ds.abs()) / 2
    }

    /// Convert to cube coordinates
    #[inline]
    pub fn to_cube(&self) -> (i32, i32, i32) {
        let x = self.q;
        let z = self.r;
        let y = -x - z;
        (x, y, z)
    }

    /// Convert to pixel coordinates (pointy-top)
    #[inline]
    pub fn to_pixel(&self, size: f32) -> (f32, f32) {
        let x = size * (3.0_f32.sqrt() * self.q as f32 + 3.0_f32.sqrt() / 2.0 * self.r as f32);
        let y = size * (3.0 / 2.0 * self.r as f32);
        (x, y)
    }
}

/// Cell state in the grid
#[derive(Clone, Copy, Debug, Default)]
pub struct CellState {
    pub owner: u8,           // 0 = neutral, 1-255 = player ID
    pub population: f32,     // Strength/population
    pub infected_by: u8,     // Who is currently attacking
    pub infection: f32,      // Infection progress (0-1)
    pub resistance: f32,     // Resistance to infection
    pub flags: u8,           // Bit flags for special states
}

// ═══════════════════════════════════════════════════════════════════════════
// HEXGRID WASM
// ═══════════════════════════════════════════════════════════════════════════

/// Main WebAssembly interface for hexgrid computations
#[wasm_bindgen]
pub struct HexGridWasm {
    width: usize,
    height: usize,
    cells: Vec<CellState>,
    // Neighbor lookup table (precomputed for O(1) access)
    neighbor_indices: Vec<[i32; 6]>,
    // Spatial hash for efficient queries
    spatial_hash: HashMap<(i32, i32), Vec<usize>>,
    spatial_cell_size: f32,
    // Infection queue for BFS
    infection_queue: VecDeque<(usize, u8)>,
    // Statistics
    territory_counts: HashMap<u8, usize>,
    total_population: f32,
    // Random number generator
    rng: rand::rngs::SmallRng,
}

#[wasm_bindgen]
impl HexGridWasm {
    /// Create a new hexgrid
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> Self {
        let size = width * height;
        let mut cells = Vec::with_capacity(size);
        let mut neighbor_indices = Vec::with_capacity(size);
        
        // Initialize cells and precompute neighbors
        for y in 0..height {
            for x in 0..width {
                cells.push(CellState::default());
                
                // Compute neighbor indices (handles odd-r offset coordinates)
                let offset = if y % 2 == 1 { 1i32 } else { 0i32 };
                let mut neighbors = [-1i32; 6];
                
                // Direction offsets for odd-r offset coordinates
                let dirs = if y % 2 == 1 {
                    [(1, 0), (0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1)]
                } else {
                    [(1, 0), (1, -1), (0, -1), (-1, 0), (0, 1), (1, 1)]
                };
                
                for (i, (dx, dy)) in dirs.iter().enumerate() {
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    
                    if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                        neighbors[i] = (ny as usize * width + nx as usize) as i32;
                    }
                }
                
                neighbor_indices.push(neighbors);
            }
        }
        
        Self {
            width,
            height,
            cells,
            neighbor_indices,
            spatial_hash: HashMap::new(),
            spatial_cell_size: 10.0,
            infection_queue: VecDeque::new(),
            territory_counts: HashMap::new(),
            total_population: 0.0,
            rng: rand::rngs::SmallRng::from_entropy(),
        }
    }

    /// Get cell owner
    #[wasm_bindgen]
    pub fn get_owner(&self, index: usize) -> u8 {
        self.cells.get(index).map(|c| c.owner).unwrap_or(0)
    }

    /// Set cell owner
    #[wasm_bindgen]
    pub fn set_owner(&mut self, index: usize, owner: u8) {
        if let Some(cell) = self.cells.get_mut(index) {
            // Update territory counts
            if cell.owner != 0 {
                *self.territory_counts.entry(cell.owner).or_insert(0) -= 1;
            }
            cell.owner = owner;
            if owner != 0 {
                *self.territory_counts.entry(owner).or_insert(0) += 1;
            }
        }
    }

    /// Set cell population
    #[wasm_bindgen]
    pub fn set_population(&mut self, index: usize, population: f32) {
        if let Some(cell) = self.cells.get_mut(index) {
            self.total_population -= cell.population;
            cell.population = population;
            self.total_population += population;
        }
    }

    /// Get neighbors of a cell (returns JS array)
    #[wasm_bindgen]
    pub fn get_neighbors(&self, index: usize) -> Vec<i32> {
        self.neighbor_indices.get(index)
            .map(|n| n.to_vec())
            .unwrap_or_default()
    }

    /// Step the infection simulation
    #[wasm_bindgen]
    pub fn step_infection(&mut self, infection_rate: f32, infection_threshold: f32) -> Vec<u32> {
        let mut changed = Vec::new();
        
        // Phase 1: Spread infection from borders
        for i in 0..self.cells.len() {
            let cell = self.cells[i];
            if cell.owner == 0 { continue; }
            
            let neighbors = &self.neighbor_indices[i];
            for &neighbor_idx in neighbors.iter() {
                if neighbor_idx < 0 { continue; }
                let ni = neighbor_idx as usize;
                let neighbor = &self.cells[ni];
                
                // Can infect if: different owner and has population
                if neighbor.owner != cell.owner && cell.population > 0.0 {
                    // Calculate infection power
                    let power = cell.population * infection_rate;
                    let resistance = (neighbor.resistance + neighbor.population).max(0.1);
                    let infection_delta = power / resistance;
                    
                    if let Some(target) = self.cells.get_mut(ni) {
                        if target.infected_by == 0 || target.infected_by == cell.owner {
                            target.infected_by = cell.owner;
                            target.infection += infection_delta;
                        }
                    }
                }
            }
        }
        
        // Phase 2: Convert fully infected cells
        for i in 0..self.cells.len() {
            let cell = &self.cells[i];
            if cell.infection >= infection_threshold && cell.infected_by != 0 {
                let new_owner = cell.infected_by;
                let old_owner = cell.owner;
                
                if let Some(target) = self.cells.get_mut(i) {
                    // Update territory counts
                    if old_owner != 0 {
                        *self.territory_counts.entry(old_owner).or_insert(0) -= 1;
                    }
                    if new_owner != 0 {
                        *self.territory_counts.entry(new_owner).or_insert(0) += 1;
                    }
                    
                    target.owner = new_owner;
                    target.infection = 0.0;
                    target.infected_by = 0;
                    target.population = 1.0;
                }
                
                changed.push(i as u32);
            }
        }
        
        // Phase 3: Decay infection on cells that aren't being actively infected
        for cell in self.cells.iter_mut() {
            if cell.infected_by == 0 && cell.infection > 0.0 {
                cell.infection *= 0.9;
                if cell.infection < 0.01 {
                    cell.infection = 0.0;
                }
            }
        }
        
        changed
    }

    /// Find connected components for a given owner
    #[wasm_bindgen]
    pub fn find_connected_regions(&self, owner: u8) -> Vec<u32> {
        let mut visited = vec![false; self.cells.len()];
        let mut region_ids = vec![0u32; self.cells.len()];
        let mut current_region = 1u32;
        
        for start in 0..self.cells.len() {
            if visited[start] || self.cells[start].owner != owner {
                continue;
            }
            
            // BFS from this cell
            let mut queue = VecDeque::new();
            queue.push_back(start);
            visited[start] = true;
            
            while let Some(idx) = queue.pop_front() {
                region_ids[idx] = current_region;
                
                for &neighbor_idx in self.neighbor_indices[idx].iter() {
                    if neighbor_idx < 0 { continue; }
                    let ni = neighbor_idx as usize;
                    
                    if !visited[ni] && self.cells[ni].owner == owner {
                        visited[ni] = true;
                        queue.push_back(ni);
                    }
                }
            }
            
            current_region += 1;
        }
        
        region_ids
    }

    /// Find border cells for a given owner
    #[wasm_bindgen]
    pub fn find_border_cells(&self, owner: u8) -> Vec<u32> {
        let mut borders = Vec::new();
        
        for i in 0..self.cells.len() {
            if self.cells[i].owner != owner { continue; }
            
            let is_border = self.neighbor_indices[i].iter().any(|&ni| {
                if ni < 0 { return true; } // Edge of grid
                self.cells[ni as usize].owner != owner
            });
            
            if is_border {
                borders.push(i as u32);
            }
        }
        
        borders
    }

    /// Compute shortest path between two cells using A*
    #[wasm_bindgen]
    pub fn find_path(&self, start: usize, end: usize, owner_filter: u8) -> Vec<u32> {
        if start >= self.cells.len() || end >= self.cells.len() {
            return Vec::new();
        }
        
        // A* implementation
        let mut open_set = std::collections::BinaryHeap::new();
        let mut came_from = HashMap::new();
        let mut g_score = HashMap::new();
        let mut in_open = HashSet::new();
        
        g_score.insert(start, 0i32);
        open_set.push(std::cmp::Reverse((self.heuristic(start, end), start)));
        in_open.insert(start);
        
        while let Some(std::cmp::Reverse((_, current))) = open_set.pop() {
            in_open.remove(&current);
            
            if current == end {
                // Reconstruct path
                let mut path = Vec::new();
                let mut curr = current;
                path.push(curr as u32);
                
                while let Some(&prev) = came_from.get(&curr) {
                    path.push(prev as u32);
                    curr = prev;
                }
                
                path.reverse();
                return path;
            }
            
            for &neighbor_idx in self.neighbor_indices[current].iter() {
                if neighbor_idx < 0 { continue; }
                let ni = neighbor_idx as usize;
                
                // Skip if owner doesn't match (0 = any)
                if owner_filter != 0 && self.cells[ni].owner != owner_filter {
                    continue;
                }
                
                let tentative_g = g_score.get(&current).copied().unwrap_or(i32::MAX) + 1;
                
                if tentative_g < g_score.get(&ni).copied().unwrap_or(i32::MAX) {
                    came_from.insert(ni, current);
                    g_score.insert(ni, tentative_g);
                    
                    if !in_open.contains(&ni) {
                        let f_score = tentative_g + self.heuristic(ni, end);
                        open_set.push(std::cmp::Reverse((f_score, ni)));
                        in_open.insert(ni);
                    }
                }
            }
        }
        
        Vec::new() // No path found
    }

    fn heuristic(&self, from: usize, to: usize) -> i32 {
        // Convert to grid coordinates
        let (x1, y1) = (from % self.width, from / self.width);
        let (x2, y2) = (to % self.width, to / self.width);
        
        // Manhattan distance as heuristic
        ((x2 as i32 - x1 as i32).abs() + (y2 as i32 - y1 as i32).abs())
    }

    /// Get territory counts for all players
    #[wasm_bindgen]
    pub fn get_territory_counts(&self) -> Vec<u32> {
        let mut counts = vec![0u32; 256];
        for (&owner, &count) in self.territory_counts.iter() {
            counts[owner as usize] = count as u32;
        }
        counts
    }

    /// Compute Gini coefficient
    #[wasm_bindgen]
    pub fn compute_gini(&self) -> f64 {
        let mut populations: Vec<f32> = self.cells.iter()
            .filter(|c| c.owner != 0)
            .map(|c| c.population)
            .collect();
        
        if populations.is_empty() {
            return 0.0;
        }
        
        populations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        
        let n = populations.len() as f64;
        let mut sum = 0.0;
        
        for (i, &pop) in populations.iter().enumerate() {
            sum += (2.0 * (i as f64 + 1.0) - n - 1.0) * pop as f64;
        }
        
        let mean = populations.iter().sum::<f32>() as f64 / n;
        if mean == 0.0 {
            return 0.0;
        }
        
        sum / (n * n * mean)
    }

    /// Compute Shannon entropy of territory distribution
    #[wasm_bindgen]
    pub fn compute_entropy(&self) -> f64 {
        let total: f64 = self.territory_counts.values().sum::<usize>() as f64;
        if total == 0.0 {
            return 0.0;
        }
        
        let mut entropy = 0.0;
        for &count in self.territory_counts.values() {
            if count > 0 {
                let p = count as f64 / total;
                entropy -= p * p.ln();
            }
        }
        
        entropy
    }

    /// Run K-means clustering on cell positions
    #[wasm_bindgen]
    pub fn kmeans_cluster(&mut self, k: usize, iterations: usize) -> Vec<u32> {
        let mut positions: Vec<(f32, f32)> = Vec::new();
        let mut cell_indices: Vec<usize> = Vec::new();
        
        // Collect all owned cells
        for i in 0..self.cells.len() {
            if self.cells[i].owner != 0 {
                let x = (i % self.width) as f32;
                let y = (i / self.width) as f32;
                positions.push((x, y));
                cell_indices.push(i);
            }
        }
        
        if positions.is_empty() || k == 0 {
            return vec![0; self.cells.len()];
        }
        
        // Initialize centroids using k-means++
        let mut centroids = Vec::with_capacity(k);
        let first_idx = self.rng.gen_range(0..positions.len());
        centroids.push(positions[first_idx]);
        
        for _ in 1..k {
            let mut distances: Vec<f32> = positions.iter().map(|p| {
                centroids.iter()
                    .map(|c| {
                        let dx = p.0 - c.0;
                        let dy = p.1 - c.1;
                        dx * dx + dy * dy
                    })
                    .fold(f32::MAX, f32::min)
            }).collect();
            
            let total: f32 = distances.iter().sum();
            if total == 0.0 { break; }
            
            let mut target = self.rng.gen::<f32>() * total;
            for (i, &d) in distances.iter().enumerate() {
                target -= d;
                if target <= 0.0 {
                    centroids.push(positions[i]);
                    break;
                }
            }
        }
        
        // Run iterations
        let mut assignments = vec![0usize; positions.len()];
        
        for _ in 0..iterations {
            // Assign points to nearest centroid
            for (i, p) in positions.iter().enumerate() {
                let mut min_dist = f32::MAX;
                let mut best_cluster = 0;
                
                for (j, c) in centroids.iter().enumerate() {
                    let dx = p.0 - c.0;
                    let dy = p.1 - c.1;
                    let dist = dx * dx + dy * dy;
                    
                    if dist < min_dist {
                        min_dist = dist;
                        best_cluster = j;
                    }
                }
                
                assignments[i] = best_cluster;
            }
            
            // Update centroids
            let mut sums = vec![(0.0f32, 0.0f32); k];
            let mut counts = vec![0usize; k];
            
            for (i, &cluster) in assignments.iter().enumerate() {
                sums[cluster].0 += positions[i].0;
                sums[cluster].1 += positions[i].1;
                counts[cluster] += 1;
            }
            
            for (j, c) in centroids.iter_mut().enumerate() {
                if counts[j] > 0 {
                    c.0 = sums[j].0 / counts[j] as f32;
                    c.1 = sums[j].1 / counts[j] as f32;
                }
            }
        }
        
        // Return cluster assignments for all cells
        let mut result = vec![0u32; self.cells.len()];
        for (i, &cell_idx) in cell_indices.iter().enumerate() {
            result[cell_idx] = assignments[i] as u32;
        }
        
        result
    }

    /// Get size of grid
    #[wasm_bindgen]
    pub fn size(&self) -> usize {
        self.cells.len()
    }

    /// Get width
    #[wasm_bindgen]
    pub fn width(&self) -> usize {
        self.width
    }

    /// Get height  
    #[wasm_bindgen]
    pub fn height(&self) -> usize {
        self.height
    }

    /// Clear all cells
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        for cell in self.cells.iter_mut() {
            *cell = CellState::default();
        }
        self.territory_counts.clear();
        self.total_population = 0.0;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOW FIELD WASM
// ═══════════════════════════════════════════════════════════════════════════

/// Flow field computation in WASM
#[wasm_bindgen]
pub struct FlowFieldWasm {
    width: usize,
    height: usize,
    velocity_x: Vec<f32>,
    velocity_y: Vec<f32>,
}

#[wasm_bindgen]
impl FlowFieldWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> Self {
        let size = width * height;
        Self {
            width,
            height,
            velocity_x: vec![0.0; size],
            velocity_y: vec![0.0; size],
        }
    }

    /// Add a source (outward flow)
    #[wasm_bindgen]
    pub fn add_source(&mut self, x: f32, y: f32, strength: f32) {
        for j in 0..self.height {
            for i in 0..self.width {
                let dx = i as f32 - x;
                let dy = j as f32 - y;
                let dist_sq = dx * dx + dy * dy + 0.0001;
                let dist = dist_sq.sqrt();
                
                let idx = j * self.width + i;
                self.velocity_x[idx] += strength * dx / (dist * dist_sq);
                self.velocity_y[idx] += strength * dy / (dist * dist_sq);
            }
        }
    }

    /// Add a vortex (rotational flow)
    #[wasm_bindgen]
    pub fn add_vortex(&mut self, x: f32, y: f32, strength: f32) {
        for j in 0..self.height {
            for i in 0..self.width {
                let dx = i as f32 - x;
                let dy = j as f32 - y;
                let dist_sq = dx * dx + dy * dy + 0.0001;
                
                let idx = j * self.width + i;
                self.velocity_x[idx] += -strength * dy / dist_sq;
                self.velocity_y[idx] += strength * dx / dist_sq;
            }
        }
    }

    /// Sample velocity at position (bilinear interpolation)
    #[wasm_bindgen]
    pub fn sample(&self, x: f32, y: f32) -> Vec<f32> {
        let x0 = (x.floor() as usize).min(self.width - 2);
        let y0 = (y.floor() as usize).min(self.height - 2);
        let x1 = x0 + 1;
        let y1 = y0 + 1;
        
        let tx = x - x0 as f32;
        let ty = y - y0 as f32;
        
        let i00 = y0 * self.width + x0;
        let i10 = y0 * self.width + x1;
        let i01 = y1 * self.width + x0;
        let i11 = y1 * self.width + x1;
        
        let vx = self.velocity_x[i00] * (1.0 - tx) * (1.0 - ty)
               + self.velocity_x[i10] * tx * (1.0 - ty)
               + self.velocity_x[i01] * (1.0 - tx) * ty
               + self.velocity_x[i11] * tx * ty;
        
        let vy = self.velocity_y[i00] * (1.0 - tx) * (1.0 - ty)
               + self.velocity_y[i10] * tx * (1.0 - ty)
               + self.velocity_y[i01] * (1.0 - tx) * ty
               + self.velocity_y[i11] * tx * ty;
        
        vec![vx, vy]
    }

    /// Compute divergence field
    #[wasm_bindgen]
    pub fn compute_divergence(&self) -> Vec<f32> {
        let mut div = vec![0.0; self.width * self.height];
        
        for j in 1..self.height - 1 {
            for i in 1..self.width - 1 {
                let idx = j * self.width + i;
                let dudx = (self.velocity_x[idx + 1] - self.velocity_x[idx - 1]) * 0.5;
                let dvdy = (self.velocity_y[idx + self.width] - self.velocity_y[idx - self.width]) * 0.5;
                div[idx] = dudx + dvdy;
            }
        }
        
        div
    }

    /// Compute curl field
    #[wasm_bindgen]
    pub fn compute_curl(&self) -> Vec<f32> {
        let mut curl = vec![0.0; self.width * self.height];
        
        for j in 1..self.height - 1 {
            for i in 1..self.width - 1 {
                let idx = j * self.width + i;
                let dvdx = (self.velocity_y[idx + 1] - self.velocity_y[idx - 1]) * 0.5;
                let dudy = (self.velocity_x[idx + self.width] - self.velocity_x[idx - self.width]) * 0.5;
                curl[idx] = dvdx - dudy;
            }
        }
        
        curl
    }

    /// Clear field
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.velocity_x.fill(0.0);
        self.velocity_y.fill(0.0);
    }
}
