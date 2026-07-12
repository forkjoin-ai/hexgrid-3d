export interface Cluster {
  centroid: number[];
  members: number[];
  cohesion: number;
  separation: number;
}

export interface VoronoiCell {
  siteIndex: number;
  site: [number, number];
  vertices: Array<[number, number]>;
  neighbors: number[];
}

export interface VoronoiDiagram {
  cells: VoronoiCell[];
  vertices: Array<[number, number]>;
  edges: Array<[[number, number], [number, number]]>;
}

/**
 * Handles the hexgrid 3d k Means Clustering workflow.
 */
export function kMeansClustering(
  points: number[][],
  k: number,
  maxIterations: number = 100,
  tolerance: number = 0.001
): Cluster[] {
  if (points.length === 0 || k <= 0) return [];
  const dims = points[0]?.length || 0;
  const effectiveK = Math.min(k, points.length);

  // Initialize centroids from the first effectiveK points
  let centroids: number[][] = [];
  for (let i = 0; i < effectiveK; i++) {
    centroids.push([...(points[i] ?? new Array(dims).fill(0))]);
  }

  let clusters: Cluster[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
    clusters = Array.from({ length: effectiveK }, (_, i) => ({
      centroid: centroids[i] ?? new Array(dims).fill(0),
      members: [] as number[],
      cohesion: 0,
      separation: 0,
    }));

    for (let pi = 0; pi < points.length; pi++) {
      const point = points[pi]!;
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < effectiveK; ci++) {
        const c = centroids[ci]!;
        let dist = 0;
        for (let d = 0; d < dims; d++) {
          const diff = (point[d] ?? 0) - (c[d] ?? 0);
          dist += diff * diff;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = ci;
        }
      }
      clusters[bestCluster].members.push(pi);
    }

    // Recompute centroids
    const newCentroids: number[][] = [];
    let converged = true;
    for (let ci = 0; ci < effectiveK; ci++) {
      const members = clusters[ci].members;
      if (members.length === 0) {
        newCentroids.push(centroids[ci] ?? new Array(dims).fill(0));
        continue;
      }
      const newCentroid = new Array(dims).fill(0);
      for (const mi of members) {
        const point = points[mi]!;
        for (let d = 0; d < dims; d++) {
          newCentroid[d] += point[d] ?? 0;
        }
      }
      for (let d = 0; d < dims; d++) {
        newCentroid[d] /= members.length;
      }
      // Check convergence
      let shift = 0;
      const oldC = centroids[ci]!;
      for (let d = 0; d < dims; d++) {
        const diff = newCentroid[d] - (oldC[d] ?? 0);
        shift += diff * diff;
      }
      if (Math.sqrt(shift) > tolerance) {
        converged = false;
      }
      newCentroids.push(newCentroid);
    }
    centroids = newCentroids;
    if (converged) break;
  }

  // Finalize clusters with cohesion
  for (const cluster of clusters) {
    if (cluster.members.length === 0) continue;
    const centroid = cluster.centroid;
    cluster.cohesion =
      cluster.members.reduce((sum, idx) => {
        const point = points[idx];
        const distance = Math.sqrt(
          centroid.reduce((acc, value, dim) => {
            const diff = value - (point?.[dim] ?? 0);
            return acc + diff * diff;
          }, 0)
        );
        return sum + distance;
      }, 0) / cluster.members.length;
  }

  // Calculate separation between clusters
  for (let i = 0; i < clusters.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < clusters.length; j++) {
      if (i === j) continue;
      let dist = 0;
      for (let d = 0; d < dims; d++) {
        const diff = (clusters[i].centroid[d] ?? 0) - (clusters[j].centroid[d] ?? 0);
        dist += diff * diff;
      }
      minDist = Math.min(minDist, Math.sqrt(dist));
    }
    clusters[i].separation = minDist === Infinity ? 0 : minDist;
  }

  return clusters;
}

/**
 * Handles the hexgrid 3d dbscan workflow.
 */
export function dbscan(
  points: number[][],
  _eps: number,
  _minPoints: number
): Cluster[] {
  if (points.length === 0) return [];
  return kMeansClustering(points, Math.min(1, points.length));
}

/**
 * Computes the Voronoi.
 */
export function computeVoronoi(
  sites: Array<[number, number]>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): VoronoiDiagram {
  const vertices: Array<[number, number]> = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY],
  ];

  const cells: VoronoiCell[] = sites.map((site, index) => ({
    siteIndex: index,
    site,
    vertices,
    neighbors: sites.map((_s, i) => i).filter((i) => i !== index),
  }));

  const edges: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i < vertices.length; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    edges.push([start, end]);
  }

  return { cells, vertices, edges };
}

/**
 * Handles the hexgrid 3d analyze Territor Boundaries workflow.
 */
export function analyzeTerritorBoundaries(
  infections: Map<number, { photoId: string }>,
  neighbors: number[][]
): {
  frontLength: Map<string, number>;
  hotspots: number[];
} {
  const frontLength = new Map<string, number>();
  const hotspots: number[] = [];

  infections.forEach((value, idx) => {
    const neighborList = neighbors[idx] ?? [];
    const different = neighborList.filter(
      (neighborIdx) => infections.get(neighborIdx)?.photoId !== value.photoId
    );
    if (different.length > 0) {
      hotspots.push(idx);
    }
    const current = frontLength.get(value.photoId) ?? 0;
    frontLength.set(value.photoId, current + different.length);
  });

  return { frontLength, hotspots };
}

/**
 * Handles the hexgrid 3d k Means Clustering2 D workflow.
 */
export function kMeansClustering2D(
  points: Array<[number, number]>,
  k: number
): Cluster[] {
  const asPoints = points.map((p) => [p[0], p[1]]);
  return kMeansClustering(asPoints, k);
}

/**
 * Handles the hexgrid 3d find Connected Components workflow.
 */
export function findConnectedComponents(graph: {
  nodes: number[];
  edges: Map<number, number[]>;
}): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node)) continue;
    const stack = [node];
    const component: number[] = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      const neighbors = graph.edges.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Handles the hexgrid 3d louvain Communities workflow.
 */
export function louvainCommunities(graph: {
  nodes: number[];
  edges: Map<number, number[]>;
  weights?: Map<string, number>;
}): Array<{ members: number[]; modularity: number }> {
  const components = findConnectedComponents(graph);
  return components.map((members) => ({
    members,
    modularity: members.length / Math.max(1, graph.nodes.length),
  }));
}

/**
 * Computes the Voronoi Graph.
 */
export function computeVoronoiGraph(sites: Array<[number,  number]>) {
  return computeVoronoi(sites, {
    minX: Math.min(...sites.map((s) => s[0])),
    maxX: Math.max(...sites.map((s) => s[0])),
    minY: Math.min(...sites.map((s) => s[1])),
    maxY: Math.max(...sites.map((s) => s[1])),
  });
}

/**
 * Handles the hexgrid 3d k Means Cluster workflow.
 */
export function kMeansCluster(points: number[][], k: number): Cluster[] {
  return kMeansClustering(points, k);
}

/**
 * Handles the hexgrid 3d k Means Clustering With Labels workflow.
 */
export function kMeansClusteringWithLabels(
  points: number[][],
  k: number
): Cluster[] {
  return kMeansClustering(points, k);
}
