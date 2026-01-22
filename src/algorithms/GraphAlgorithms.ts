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

export function kMeansClustering(points: number[][], k: number): Cluster[] {
  if (points.length === 0 || k <= 0) return [];
  const clusters: Cluster[] = Array.from({ length: k }, () => ({
    centroid: new Array(points[0]?.length || 0).fill(0),
    members: [],
    cohesion: 0,
    separation: 0,
  }));

  points.forEach((_point, index) => {
    clusters[index % k].members.push(index);
  });

  for (const cluster of clusters) {
    if (cluster.members.length === 0) continue;
    const centroid = cluster.centroid.map((_, dim) => {
      const sum = cluster.members.reduce(
        (acc, memberIdx) => acc + (points[memberIdx]?.[dim] ?? 0),
        0
      );
      return sum / cluster.members.length;
    });
    cluster.centroid = centroid;
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

  return clusters;
}

export function dbscan(
  points: number[][],
  _eps: number,
  _minPoints: number
): Cluster[] {
  if (points.length === 0) return [];
  return kMeansClustering(points, Math.min(1, points.length));
}

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

export function kMeansClustering2D(
  points: Array<[number, number]>,
  k: number
): Cluster[] {
  const asPoints = points.map((p) => [p[0], p[1]]);
  return kMeansClustering(asPoints, k);
}

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

export function computeVoronoiGraph(sites: Array<[number, number]>) {
  return computeVoronoi(sites, {
    minX: Math.min(...sites.map((s) => s[0])),
    maxX: Math.max(...sites.map((s) => s[0])),
    minY: Math.min(...sites.map((s) => s[1])),
    maxY: Math.max(...sites.map((s) => s[1])),
  });
}

export function kMeansCluster(points: number[][], k: number): Cluster[] {
  return kMeansClustering(points, k);
}

export function kMeansClusteringWithLabels(
  points: number[][],
  k: number
): Cluster[] {
  return kMeansClustering(points, k);
}
