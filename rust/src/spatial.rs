//! Spatial indexing structures for fast queries

use std::collections::HashMap;

/// KD-Tree for 2D points
pub struct KDTree {
    nodes: Vec<KDNode>,
    dimension: usize,
}

struct KDNode {
    point: [f32; 2],
    data_index: usize,
    left: Option<usize>,
    right: Option<usize>,
}

impl KDTree {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            dimension: 2,
        }
    }

    pub fn build(points: &[(f32, f32, usize)]) -> Self {
        let mut tree = Self::new();
        if points.is_empty() {
            return tree;
        }
        
        let mut indices: Vec<usize> = (0..points.len()).collect();
        tree.build_recursive(&mut indices, points, 0);
        tree
    }

    fn build_recursive(
        &mut self,
        indices: &mut [usize],
        points: &[(f32, f32, usize)],
        depth: usize,
    ) -> Option<usize> {
        if indices.is_empty() {
            return None;
        }

        let axis = depth % self.dimension;
        
        // Sort by axis
        indices.sort_by(|&a, &b| {
            let va = if axis == 0 { points[a].0 } else { points[a].1 };
            let vb = if axis == 0 { points[b].0 } else { points[b].1 };
            va.partial_cmp(&vb).unwrap_or(std::cmp::Ordering::Equal)
        });

        let mid = indices.len() / 2;
        let point_idx = indices[mid];
        let point = points[point_idx];

        let node_idx = self.nodes.len();
        self.nodes.push(KDNode {
            point: [point.0, point.1],
            data_index: point.2,
            left: None,
            right: None,
        });

        let (left, right) = indices.split_at_mut(mid);
        let right = &mut right[1..]; // Skip median

        let left_child = self.build_recursive(left, points, depth + 1);
        let right_child = self.build_recursive(right, points, depth + 1);

        self.nodes[node_idx].left = left_child;
        self.nodes[node_idx].right = right_child;

        Some(node_idx)
    }

    /// Find k nearest neighbors
    pub fn k_nearest(&self, query: (f32, f32), k: usize) -> Vec<(usize, f32)> {
        if self.nodes.is_empty() {
            return Vec::new();
        }

        let mut best = Vec::with_capacity(k);
        self.k_nearest_recursive(0, [query.0, query.1], k, 0, &mut best);
        best.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        best
    }

    fn k_nearest_recursive(
        &self,
        node_idx: usize,
        query: [f32; 2],
        k: usize,
        depth: usize,
        best: &mut Vec<(usize, f32)>,
    ) {
        let node = &self.nodes[node_idx];
        let axis = depth % self.dimension;

        let dx = query[0] - node.point[0];
        let dy = query[1] - node.point[1];
        let dist_sq = dx * dx + dy * dy;
        let dist = dist_sq.sqrt();

        // Check if this node is a candidate
        if best.len() < k {
            best.push((node.data_index, dist));
        } else if dist < best.last().unwrap().1 {
            best.pop();
            best.push((node.data_index, dist));
            best.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        }

        // Determine which side to search first
        let diff = query[axis] - node.point[axis];
        let (first, second) = if diff < 0.0 {
            (node.left, node.right)
        } else {
            (node.right, node.left)
        };

        // Search first side
        if let Some(child) = first {
            self.k_nearest_recursive(child, query, k, depth + 1, best);
        }

        // Check if we need to search the other side
        let worst_dist = if best.len() < k {
            f32::MAX
        } else {
            best.last().unwrap().1
        };

        if diff.abs() < worst_dist {
            if let Some(child) = second {
                self.k_nearest_recursive(child, query, k, depth + 1, best);
            }
        }
    }

    /// Range query - find all points within radius
    pub fn range_query(&self, center: (f32, f32), radius: f32) -> Vec<usize> {
        if self.nodes.is_empty() {
            return Vec::new();
        }

        let mut results = Vec::new();
        self.range_query_recursive(0, [center.0, center.1], radius, 0, &mut results);
        results
    }

    fn range_query_recursive(
        &self,
        node_idx: usize,
        center: [f32; 2],
        radius: f32,
        depth: usize,
        results: &mut Vec<usize>,
    ) {
        let node = &self.nodes[node_idx];
        let axis = depth % self.dimension;

        // Check if this point is within radius
        let dx = center[0] - node.point[0];
        let dy = center[1] - node.point[1];
        let dist_sq = dx * dx + dy * dy;

        if dist_sq <= radius * radius {
            results.push(node.data_index);
        }

        // Check which children to search
        let diff = center[axis] - node.point[axis];

        // Search side containing query point
        if diff < radius {
            if let Some(child) = node.left {
                self.range_query_recursive(child, center, radius, depth + 1, results);
            }
        }
        if diff > -radius {
            if let Some(child) = node.right {
                self.range_query_recursive(child, center, radius, depth + 1, results);
            }
        }
    }
}

/// Spatial hash grid for O(1) average case queries
pub struct SpatialHashGrid {
    cell_size: f32,
    inv_cell_size: f32,
    cells: HashMap<(i32, i32), Vec<usize>>,
}

impl SpatialHashGrid {
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            inv_cell_size: 1.0 / cell_size,
            cells: HashMap::new(),
        }
    }

    fn cell_key(&self, x: f32, y: f32) -> (i32, i32) {
        (
            (x * self.inv_cell_size).floor() as i32,
            (y * self.inv_cell_size).floor() as i32,
        )
    }

    pub fn insert(&mut self, x: f32, y: f32, index: usize) {
        let key = self.cell_key(x, y);
        self.cells.entry(key).or_insert_with(Vec::new).push(index);
    }

    pub fn query_radius(&self, x: f32, y: f32, radius: f32) -> Vec<usize> {
        let mut results = Vec::new();
        let cells_to_check = (radius * self.inv_cell_size).ceil() as i32 + 1;
        let center_key = self.cell_key(x, y);

        for dy in -cells_to_check..=cells_to_check {
            for dx in -cells_to_check..=cells_to_check {
                let key = (center_key.0 + dx, center_key.1 + dy);
                if let Some(indices) = self.cells.get(&key) {
                    results.extend(indices.iter().copied());
                }
            }
        }

        results
    }

    pub fn query_cell(&self, x: f32, y: f32) -> Option<&Vec<usize>> {
        let key = self.cell_key(x, y);
        self.cells.get(&key)
    }

    pub fn clear(&mut self) {
        self.cells.clear();
    }
}
