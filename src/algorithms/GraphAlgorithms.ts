/**
 * Graph Algorithms for Hexagonal Grid Analysis
 * 
 * This module provides advanced graph theory algorithms:
 * - K-Means Clustering (with k-means++ initialization)
 * - Voronoi Diagrams (Fortune's algorithm)
 * - Connected Components (Tarjan's algorithm)
 * - Shortest Paths (Dijkstra, A*)
 * - Maximum Flow (Ford-Fulkerson / Edmonds-Karp)
 * - Community Detection (Louvain algorithm)
 * - Minimum Spanning Tree (Prim's, Kruskal's)
 * - Spectral Clustering
 * 
 * @module algorithms/GraphAlgorithms
 */

import { Vector2, Vector3 } from '../math/Vector3'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Graph {
  nodes: number[]
  edges: Map<number, number[]>  // adjacency list
  weights?: Map<string, number> // edge weights as "from-to" keys
}

export interface WeightedGraph extends Graph {
  weights: Map<string, number>
}

export interface Cluster {
  id: number
  centroid: number[]
  members: number[]
  cohesion: number  // average distance to centroid
  separation: number // distance to nearest other centroid
}

export interface VoronoiCell {
  site: number[]
  siteIndex: number
  vertices: number[][]
  neighbors: number[]
}

export interface VoronoiDiagram {
  cells: VoronoiCell[]
  vertices: number[][]
  edges: Array<{ start: number[]; end: number[]; leftSite: number; rightSite: number }>
}

export interface PathResult {
  path: number[]
  distance: number
  visited: number
}

export interface FlowResult {
  maxFlow: number
  flowGraph: Map<string, number>
  minCut: number[]
}

export interface Community {
  id: number
  members: number[]
  modularity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// K-MEANS CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * K-Means clustering with k-means++ initialization
 * 
 * @param points Array of points to cluster
 * @param k Number of clusters
 * @param maxIterations Maximum iterations before stopping
 * @param tolerance Convergence tolerance (centroid movement)
 */
export function kMeansClustering(
  points: number[][],
  k: number,
  maxIterations: number = 100,
  tolerance: number = 0.001
): Cluster[] {
  if (points.length === 0 || k <= 0) return []
  
  const actualK = Math.min(k, points.length)
  const dimensions = points[0].length
  
  // K-means++ initialization
  const centroids = kMeansPlusPlusInit(points, actualK)
  
  let assignments: number[] = new Array(points.length).fill(0)
  let converged = false
  let iteration = 0
  
  while (!converged && iteration < maxIterations) {
    // Assignment step: assign each point to nearest centroid
    const newAssignments = points.map(point => {
      let minDist = Infinity
      let nearest = 0
      
      for (let c = 0; c < actualK; c++) {
        const dist = squaredDistance(point, centroids[c])
        if (dist < minDist) {
          minDist = dist
          nearest = c
        }
      }
      
      return nearest
    })
    
    // Update step: recalculate centroids
    const newCentroids: number[][] = Array(actualK).fill(null).map(() => 
      Array(dimensions).fill(0)
    )
    const counts = Array(actualK).fill(0)
    
    for (let i = 0; i < points.length; i++) {
      const cluster = newAssignments[i]
      counts[cluster]++
      for (let d = 0; d < dimensions; d++) {
        newCentroids[cluster][d] += points[i][d]
      }
    }
    
    // Compute new centroids and check convergence
    let maxMovement = 0
    for (let c = 0; c < actualK; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < dimensions; d++) {
          newCentroids[c][d] /= counts[c]
        }
        
        const movement = Math.sqrt(squaredDistance(centroids[c], newCentroids[c]))
        maxMovement = Math.max(maxMovement, movement)
        
        centroids[c] = newCentroids[c]
      }
    }
    
    converged = maxMovement < tolerance
    assignments = newAssignments
    iteration++
  }
  
  // Build cluster objects
  const clusters: Cluster[] = centroids.map((centroid, id) => ({
    id,
    centroid,
    members: [],
    cohesion: 0,
    separation: 0
  }))
  
  // Assign members
  for (let i = 0; i < points.length; i++) {
    clusters[assignments[i]].members.push(i)
  }
  
  // Calculate cohesion (average distance to centroid)
  for (const cluster of clusters) {
    if (cluster.members.length > 0) {
      let totalDist = 0
      for (const member of cluster.members) {
        totalDist += Math.sqrt(squaredDistance(points[member], cluster.centroid))
      }
      cluster.cohesion = totalDist / cluster.members.length
    }
  }
  
  // Calculate separation (distance to nearest other centroid)
  for (let i = 0; i < clusters.length; i++) {
    let minDist = Infinity
    for (let j = 0; j < clusters.length; j++) {
      if (i !== j) {
        const dist = Math.sqrt(squaredDistance(clusters[i].centroid, clusters[j].centroid))
        minDist = Math.min(minDist, dist)
      }
    }
    clusters[i].separation = minDist === Infinity ? 0 : minDist
  }
  
  return clusters.filter(c => c.members.length > 0)
}

/**
 * K-means++ initialization: choose centroids to maximize spread
 */
function kMeansPlusPlusInit(points: number[][], k: number): number[][] {
  const centroids: number[][] = []
  
  // First centroid: random point
  const firstIdx = Math.floor(Math.random() * points.length)
  centroids.push([...points[firstIdx]])
  
  // Remaining centroids: weighted probability based on distance
  for (let c = 1; c < k; c++) {
    const distances: number[] = points.map(point => {
      let minDist = Infinity
      for (const centroid of centroids) {
        minDist = Math.min(minDist, squaredDistance(point, centroid))
      }
      return minDist
    })
    
    const totalDist = distances.reduce((a, b) => a + b, 0)
    
    // Weighted random selection
    let rand = Math.random() * totalDist
    for (let i = 0; i < points.length; i++) {
      rand -= distances[i]
      if (rand <= 0) {
        centroids.push([...points[i]])
        break
      }
    }
    
    // Fallback if we didn't select one
    if (centroids.length <= c) {
      const idx = Math.floor(Math.random() * points.length)
      centroids.push([...points[idx]])
    }
  }
  
  return centroids
}

/**
 * Silhouette score for cluster quality evaluation
 * Returns value in [-1, 1], higher is better
 */
export function silhouetteScore(points: number[][], assignments: number[]): number {
  if (points.length <= 1) return 0
  
  const k = Math.max(...assignments) + 1
  if (k <= 1) return 0
  
  let totalScore = 0
  
  for (let i = 0; i < points.length; i++) {
    const myCluster = assignments[i]
    
    // a(i): mean distance to other points in same cluster
    let a = 0
    let sameCount = 0
    for (let j = 0; j < points.length; j++) {
      if (i !== j && assignments[j] === myCluster) {
        a += Math.sqrt(squaredDistance(points[i], points[j]))
        sameCount++
      }
    }
    a = sameCount > 0 ? a / sameCount : 0
    
    // b(i): minimum mean distance to points in other clusters
    let b = Infinity
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue
      
      let dist = 0
      let count = 0
      for (let j = 0; j < points.length; j++) {
        if (assignments[j] === c) {
          dist += Math.sqrt(squaredDistance(points[i], points[j]))
          count++
        }
      }
      
      if (count > 0) {
        b = Math.min(b, dist / count)
      }
    }
    
    if (b === Infinity) b = 0
    
    // s(i) = (b - a) / max(a, b)
    const maxAB = Math.max(a, b)
    const s = maxAB > 0 ? (b - a) / maxAB : 0
    totalScore += s
  }
  
  return totalScore / points.length
}

/**
 * Elbow method: find optimal k by analyzing within-cluster sum of squares
 */
export function findOptimalK(
  points: number[][],
  maxK: number = 10
): { k: number; wcss: number[] } {
  const wcss: number[] = []
  
  for (let k = 1; k <= Math.min(maxK, points.length); k++) {
    const clusters = kMeansClustering(points, k)
    
    let totalWCSS = 0
    for (const cluster of clusters) {
      for (const member of cluster.members) {
        totalWCSS += squaredDistance(points[member], cluster.centroid)
      }
    }
    
    wcss.push(totalWCSS)
  }
  
  // Find elbow using the maximum curvature method
  let maxCurvature = 0
  let optimalK = 1
  
  for (let i = 1; i < wcss.length - 1; i++) {
    // Second derivative approximation
    const curvature = Math.abs(wcss[i - 1] - 2 * wcss[i] + wcss[i + 1])
    if (curvature > maxCurvature) {
      maxCurvature = curvature
      optimalK = i + 1
    }
  }
  
  return { k: optimalK, wcss }
}

// ═══════════════════════════════════════════════════════════════════════════
// DBSCAN CLUSTERING (Density-Based)
// ═══════════════════════════════════════════════════════════════════════════

export interface DBSCANResult {
  clusters: number[][] // array of point indices per cluster
  noise: number[]      // indices of noise points
  labels: number[]     // cluster label per point (-1 for noise)
}

/**
 * DBSCAN: Density-Based Spatial Clustering of Applications with Noise
 * 
 * @param points Array of points
 * @param epsilon Neighborhood radius
 * @param minPoints Minimum points to form a cluster
 */
export function dbscan(
  points: number[][],
  epsilon: number,
  minPoints: number
): DBSCANResult {
  const n = points.length
  const labels: number[] = new Array(n).fill(-2) // -2 = undefined, -1 = noise
  const clusters: number[][] = []
  let currentCluster = 0
  
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue
    
    const neighbors = regionQuery(points, i, epsilon)
    
    if (neighbors.length < minPoints) {
      labels[i] = -1 // Noise
      continue
    }
    
    // Start new cluster
    const cluster: number[] = []
    clusters.push(cluster)
    expandCluster(points, labels, i, neighbors, currentCluster, cluster, epsilon, minPoints)
    currentCluster++
  }
  
  return {
    clusters,
    noise: labels.map((l, i) => l === -1 ? i : -1).filter(i => i !== -1),
    labels
  }
}

function regionQuery(points: number[][], pointIdx: number, epsilon: number): number[] {
  const neighbors: number[] = []
  const epsSq = epsilon * epsilon
  
  for (let i = 0; i < points.length; i++) {
    if (squaredDistance(points[pointIdx], points[i]) <= epsSq) {
      neighbors.push(i)
    }
  }
  
  return neighbors
}

function expandCluster(
  points: number[][],
  labels: number[],
  pointIdx: number,
  neighbors: number[],
  clusterId: number,
  cluster: number[],
  epsilon: number,
  minPoints: number
): void {
  labels[pointIdx] = clusterId
  cluster.push(pointIdx)
  
  const queue = [...neighbors]
  
  while (queue.length > 0) {
    const currentPoint = queue.shift()!
    
    if (labels[currentPoint] === -1) {
      labels[currentPoint] = clusterId
      cluster.push(currentPoint)
    }
    
    if (labels[currentPoint] !== -2) continue
    
    labels[currentPoint] = clusterId
    cluster.push(currentPoint)
    
    const currentNeighbors = regionQuery(points, currentPoint, epsilon)
    
    if (currentNeighbors.length >= minPoints) {
      queue.push(...currentNeighbors)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTED COMPONENTS (Tarjan's Algorithm)
// ═══════════════════════════════════════════════════════════════════════════

export interface ConnectedComponent {
  id: number
  nodes: number[]
  size: number
}

/**
 * Find all connected components in an undirected graph
 */
export function findConnectedComponents(graph: Graph): ConnectedComponent[] {
  const visited = new Set<number>()
  const components: ConnectedComponent[] = []
  
  for (const node of graph.nodes) {
    if (visited.has(node)) continue
    
    const component: number[] = []
    const queue = [node]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      
      if (visited.has(current)) continue
      visited.add(current)
      component.push(current)
      
      const neighbors = graph.edges.get(current) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor)
        }
      }
    }
    
    components.push({
      id: components.length,
      nodes: component,
      size: component.length
    })
  }
  
  return components.sort((a, b) => b.size - a.size)
}

/**
 * Find strongly connected components in a directed graph (Tarjan's algorithm)
 */
export function findStronglyConnectedComponents(graph: Graph): ConnectedComponent[] {
  let index = 0
  const stack: number[] = []
  const onStack = new Set<number>()
  const indices = new Map<number, number>()
  const lowLinks = new Map<number, number>()
  const components: ConnectedComponent[] = []
  
  function strongConnect(v: number): void {
    indices.set(v, index)
    lowLinks.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)
    
    const neighbors = graph.edges.get(v) || []
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w)
        lowLinks.set(v, Math.min(lowLinks.get(v)!, lowLinks.get(w)!))
      } else if (onStack.has(w)) {
        lowLinks.set(v, Math.min(lowLinks.get(v)!, indices.get(w)!))
      }
    }
    
    if (lowLinks.get(v) === indices.get(v)) {
      const component: number[] = []
      let w: number
      do {
        w = stack.pop()!
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      
      components.push({
        id: components.length,
        nodes: component,
        size: component.length
      })
    }
  }
  
  for (const node of graph.nodes) {
    if (!indices.has(node)) {
      strongConnect(node)
    }
  }
  
  return components.sort((a, b) => b.size - a.size)
}

// ═══════════════════════════════════════════════════════════════════════════
// SHORTEST PATHS (Dijkstra & A*)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dijkstra's algorithm for shortest path
 */
export function dijkstra(
  graph: WeightedGraph,
  start: number,
  end: number
): PathResult {
  const distances = new Map<number, number>()
  const previous = new Map<number, number>()
  const visited = new Set<number>()
  
  // Priority queue using array (simple implementation)
  const queue: Array<{ node: number; distance: number }> = []
  
  distances.set(start, 0)
  queue.push({ node: start, distance: 0 })
  
  while (queue.length > 0) {
    // Get node with minimum distance
    queue.sort((a, b) => a.distance - b.distance)
    const { node: current, distance: currentDist } = queue.shift()!
    
    if (visited.has(current)) continue
    visited.add(current)
    
    if (current === end) {
      // Reconstruct path
      const path: number[] = []
      let curr: number | undefined = end
      while (curr !== undefined) {
        path.unshift(curr)
        curr = previous.get(curr)
      }
      return { path, distance: currentDist, visited: visited.size }
    }
    
    const neighbors = graph.edges.get(current) || []
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      
      const edgeKey = `${current}-${neighbor}`
      const weight = graph.weights.get(edgeKey) ?? 1
      const distance = currentDist + weight
      
      if (distance < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, distance)
        previous.set(neighbor, current)
        queue.push({ node: neighbor, distance })
      }
    }
  }
  
  return { path: [], distance: Infinity, visited: visited.size }
}

/**
 * A* algorithm with heuristic
 */
export function aStar(
  graph: WeightedGraph,
  start: number,
  end: number,
  positions: number[][],  // positions[nodeId] = [x, y, z, ...]
  heuristicFn?: (a: number[], b: number[]) => number
): PathResult {
  const heuristic = heuristicFn || ((a, b) => Math.sqrt(squaredDistance(a, b)))
  
  const gScore = new Map<number, number>()
  const fScore = new Map<number, number>()
  const previous = new Map<number, number>()
  const visited = new Set<number>()
  
  gScore.set(start, 0)
  fScore.set(start, heuristic(positions[start], positions[end]))
  
  const openSet: number[] = [start]
  
  while (openSet.length > 0) {
    // Get node with lowest fScore
    openSet.sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity))
    const current = openSet.shift()!
    
    if (current === end) {
      const path: number[] = []
      let curr: number | undefined = end
      while (curr !== undefined) {
        path.unshift(curr)
        curr = previous.get(curr)
      }
      return { path, distance: gScore.get(end)!, visited: visited.size }
    }
    
    visited.add(current)
    
    const neighbors = graph.edges.get(current) || []
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue
      
      const edgeKey = `${current}-${neighbor}`
      const weight = graph.weights.get(edgeKey) ?? 1
      const tentativeG = (gScore.get(current) ?? Infinity) + weight
      
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        previous.set(neighbor, current)
        gScore.set(neighbor, tentativeG)
        fScore.set(neighbor, tentativeG + heuristic(positions[neighbor], positions[end]))
        
        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor)
        }
      }
    }
  }
  
  return { path: [], distance: Infinity, visited: visited.size }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAXIMUM FLOW (Edmonds-Karp / Ford-Fulkerson with BFS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maximum flow using Edmonds-Karp algorithm (BFS-based Ford-Fulkerson)
 */
export function maxFlow(
  graph: WeightedGraph,
  source: number,
  sink: number
): FlowResult {
  // Create residual graph
  const residual = new Map<string, number>()
  
  for (const [key, capacity] of graph.weights) {
    residual.set(key, capacity)
    // Add reverse edge with 0 capacity if not exists
    const [from, to] = key.split('-').map(Number)
    const reverseKey = `${to}-${from}`
    if (!residual.has(reverseKey)) {
      residual.set(reverseKey, 0)
    }
  }
  
  let totalFlow = 0
  
  // BFS to find augmenting path
  const findPath = (): { path: number[]; minCapacity: number } | null => {
    const visited = new Set<number>()
    const parent = new Map<number, number>()
    const queue = [source]
    visited.add(source)
    
    while (queue.length > 0) {
      const current = queue.shift()!
      
      if (current === sink) {
        // Reconstruct path and find minimum capacity
        const path: number[] = []
        let node = sink
        let minCapacity = Infinity
        
        while (node !== source) {
          path.unshift(node)
          const prev = parent.get(node)!
          const key = `${prev}-${node}`
          minCapacity = Math.min(minCapacity, residual.get(key)!)
          node = prev
        }
        path.unshift(source)
        
        return { path, minCapacity }
      }
      
      const neighbors = graph.edges.get(current) || []
      for (const neighbor of neighbors) {
        const key = `${current}-${neighbor}`
        const capacity = residual.get(key) || 0
        
        if (!visited.has(neighbor) && capacity > 0) {
          visited.add(neighbor)
          parent.set(neighbor, current)
          queue.push(neighbor)
        }
      }
      
      // Also check reverse edges for residual graph
      for (const node of graph.nodes) {
        const key = `${current}-${node}`
        const capacity = residual.get(key) || 0
        
        if (!visited.has(node) && capacity > 0) {
          visited.add(node)
          parent.set(node, current)
          queue.push(node)
        }
      }
    }
    
    return null
  }
  
  // Augment flow while path exists
  let pathResult = findPath()
  while (pathResult) {
    const { path, minCapacity } = pathResult
    totalFlow += minCapacity
    
    // Update residual capacities
    for (let i = 0; i < path.length - 1; i++) {
      const forwardKey = `${path[i]}-${path[i + 1]}`
      const backwardKey = `${path[i + 1]}-${path[i]}`
      
      residual.set(forwardKey, (residual.get(forwardKey) || 0) - minCapacity)
      residual.set(backwardKey, (residual.get(backwardKey) || 0) + minCapacity)
    }
    
    pathResult = findPath()
  }
  
  // Find min-cut (nodes reachable from source in residual graph)
  const minCut: number[] = []
  const visited = new Set<number>()
  const queue = [source]
  visited.add(source)
  
  while (queue.length > 0) {
    const current = queue.shift()!
    minCut.push(current)
    
    for (const node of graph.nodes) {
      const key = `${current}-${node}`
      if (!visited.has(node) && (residual.get(key) || 0) > 0) {
        visited.add(node)
        queue.push(node)
      }
    }
  }
  
  return {
    maxFlow: totalFlow,
    flowGraph: residual,
    minCut
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY DETECTION (Louvain Algorithm)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Louvain algorithm for community detection
 * Maximizes modularity through iterative local optimization
 */
export function louvainCommunities(graph: WeightedGraph): Community[] {
  const n = graph.nodes.length
  if (n === 0) return []
  
  // Initialize: each node is its own community
  const communities = new Map<number, number>() // node -> community
  for (let i = 0; i < n; i++) {
    communities.set(graph.nodes[i], i)
  }
  
  // Calculate total weight of graph
  let totalWeight = 0
  for (const weight of graph.weights.values()) {
    totalWeight += weight
  }
  if (totalWeight === 0) totalWeight = graph.edges.size
  
  // Calculate weighted degree of each node
  const degrees = new Map<number, number>()
  for (const node of graph.nodes) {
    let degree = 0
    const neighbors = graph.edges.get(node) || []
    for (const neighbor of neighbors) {
      const key = `${node}-${neighbor}`
      degree += graph.weights.get(key) || 1
    }
    degrees.set(node, degree)
  }
  
  let improved = true
  let iterations = 0
  const maxIterations = 100
  
  while (improved && iterations < maxIterations) {
    improved = false
    iterations++
    
    for (const node of graph.nodes) {
      const currentCommunity = communities.get(node)!
      
      // Calculate modularity gain for moving to each neighbor's community
      let bestCommunity = currentCommunity
      let bestGain = 0
      
      const neighbors = graph.edges.get(node) || []
      const neighborCommunities = new Set(neighbors.map(n => communities.get(n)!))
      
      for (const targetCommunity of neighborCommunities) {
        if (targetCommunity === currentCommunity) continue
        
        const gain = modularityGain(
          node, targetCommunity, communities, graph, degrees, totalWeight
        )
        
        if (gain > bestGain) {
          bestGain = gain
          bestCommunity = targetCommunity
        }
      }
      
      if (bestCommunity !== currentCommunity) {
        communities.set(node, bestCommunity)
        improved = true
      }
    }
  }
  
  // Group nodes by community
  const communityGroups = new Map<number, number[]>()
  for (const [node, comm] of communities) {
    if (!communityGroups.has(comm)) {
      communityGroups.set(comm, [])
    }
    communityGroups.get(comm)!.push(node)
  }
  
  // Build result
  const result: Community[] = []
  let id = 0
  for (const [, members] of communityGroups) {
    result.push({
      id: id++,
      members,
      modularity: calculateCommunityModularity(members, graph, degrees, totalWeight)
    })
  }
  
  return result.sort((a, b) => b.members.length - a.members.length)
}

function modularityGain(
  node: number,
  targetCommunity: number,
  communities: Map<number, number>,
  graph: WeightedGraph,
  degrees: Map<number, number>,
  totalWeight: number
): number {
  const ki = degrees.get(node) || 0
  
  let sumIn = 0
  let sumTot = 0
  
  for (const [n, comm] of communities) {
    if (comm === targetCommunity) {
      sumTot += degrees.get(n) || 0
      
      const key1 = `${node}-${n}`
      const key2 = `${n}-${node}`
      sumIn += (graph.weights.get(key1) || 0) + (graph.weights.get(key2) || 0)
    }
  }
  
  const m2 = 2 * totalWeight
  return (sumIn / m2) - (2 * sumTot * ki) / (m2 * m2)
}

function calculateCommunityModularity(
  members: number[],
  graph: WeightedGraph,
  degrees: Map<number, number>,
  totalWeight: number
): number {
  const memberSet = new Set(members)
  let eii = 0
  let ai = 0
  
  for (const node of members) {
    ai += degrees.get(node) || 0
    
    const neighbors = graph.edges.get(node) || []
    for (const neighbor of neighbors) {
      if (memberSet.has(neighbor)) {
        const key = `${node}-${neighbor}`
        eii += graph.weights.get(key) || 1
      }
    }
  }
  
  eii /= 2 // Count each edge once
  const m = totalWeight
  
  return (eii / m) - (ai / (2 * m)) ** 2
}

// ═══════════════════════════════════════════════════════════════════════════
// MINIMUM SPANNING TREE
// ═══════════════════════════════════════════════════════════════════════════

export interface MST {
  edges: Array<{ from: number; to: number; weight: number }>
  totalWeight: number
}

/**
 * Prim's algorithm for minimum spanning tree
 */
export function primMST(graph: WeightedGraph): MST {
  if (graph.nodes.length === 0) return { edges: [], totalWeight: 0 }
  
  const inMST = new Set<number>()
  const edges: Array<{ from: number; to: number; weight: number }> = []
  let totalWeight = 0
  
  // Start from first node
  inMST.add(graph.nodes[0])
  
  while (inMST.size < graph.nodes.length) {
    let minEdge: { from: number; to: number; weight: number } | null = null
    let minWeight = Infinity
    
    for (const node of inMST) {
      const neighbors = graph.edges.get(node) || []
      for (const neighbor of neighbors) {
        if (inMST.has(neighbor)) continue
        
        const key = `${node}-${neighbor}`
        const weight = graph.weights.get(key) || 1
        
        if (weight < minWeight) {
          minWeight = weight
          minEdge = { from: node, to: neighbor, weight }
        }
      }
    }
    
    if (!minEdge) break // Graph is disconnected
    
    edges.push(minEdge)
    totalWeight += minEdge.weight
    inMST.add(minEdge.to)
  }
  
  return { edges, totalWeight }
}

/**
 * Kruskal's algorithm for minimum spanning tree
 */
export function kruskalMST(graph: WeightedGraph): MST {
  // Collect all edges
  const allEdges: Array<{ from: number; to: number; weight: number }> = []
  
  for (const [key, weight] of graph.weights) {
    const [from, to] = key.split('-').map(Number)
    allEdges.push({ from, to, weight })
  }
  
  // Sort by weight
  allEdges.sort((a, b) => a.weight - b.weight)
  
  // Union-Find
  const parent = new Map<number, number>()
  const rank = new Map<number, number>()
  
  for (const node of graph.nodes) {
    parent.set(node, node)
    rank.set(node, 0)
  }
  
  const find = (x: number): number => {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!))
    }
    return parent.get(x)!
  }
  
  const union = (x: number, y: number): boolean => {
    const rootX = find(x)
    const rootY = find(y)
    
    if (rootX === rootY) return false
    
    if (rank.get(rootX)! < rank.get(rootY)!) {
      parent.set(rootX, rootY)
    } else if (rank.get(rootX)! > rank.get(rootY)!) {
      parent.set(rootY, rootX)
    } else {
      parent.set(rootY, rootX)
      rank.set(rootX, rank.get(rootX)! + 1)
    }
    
    return true
  }
  
  const mstEdges: Array<{ from: number; to: number; weight: number }> = []
  let totalWeight = 0
  
  for (const edge of allEdges) {
    if (union(edge.from, edge.to)) {
      mstEdges.push(edge)
      totalWeight += edge.weight
      
      if (mstEdges.length === graph.nodes.length - 1) break
    }
  }
  
  return { edges: mstEdges, totalWeight }
}

// ═══════════════════════════════════════════════════════════════════════════
// VORONOI DIAGRAM (Fortune's Algorithm - Simplified)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute Voronoi diagram using brute force (simple implementation)
 * For production use, implement Fortune's O(n log n) algorithm
 */
export function computeVoronoi(
  sites: number[][],
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): VoronoiDiagram {
  const cells: VoronoiCell[] = sites.map((site, i) => ({
    site,
    siteIndex: i,
    vertices: [],
    neighbors: []
  }))
  
  const edges: Array<{ start: number[]; end: number[]; leftSite: number; rightSite: number }> = []
  const vertices: number[][] = []
  
  // For each pair of sites, compute the perpendicular bisector
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const bisector = perpendicularBisector(sites[i], sites[j])
      
      // Clip to bounds
      const clipped = clipToBounds(bisector, bounds)
      if (clipped) {
        edges.push({
          start: clipped.start,
          end: clipped.end,
          leftSite: i,
          rightSite: j
        })
        
        cells[i].neighbors.push(j)
        cells[j].neighbors.push(i)
      }
    }
  }
  
  return { cells, vertices, edges }
}

function perpendicularBisector(p1: number[], p2: number[]): { point: number[]; direction: number[] } {
  const midpoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  // Perpendicular direction
  const direction = [-dy, dx]
  return { point: midpoint, direction }
}

function clipToBounds(
  line: { point: number[]; direction: number[] },
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): { start: number[]; end: number[] } | null {
  const { point, direction } = line
  
  // Parameterize line: P(t) = point + t * direction
  // Find intersections with bounds
  const intersections: Array<{ t: number; point: number[] }> = []
  
  // Left edge (x = minX)
  if (direction[0] !== 0) {
    const t = (bounds.minX - point[0]) / direction[0]
    const y = point[1] + t * direction[1]
    if (y >= bounds.minY && y <= bounds.maxY) {
      intersections.push({ t, point: [bounds.minX, y] })
    }
  }
  
  // Right edge (x = maxX)
  if (direction[0] !== 0) {
    const t = (bounds.maxX - point[0]) / direction[0]
    const y = point[1] + t * direction[1]
    if (y >= bounds.minY && y <= bounds.maxY) {
      intersections.push({ t, point: [bounds.maxX, y] })
    }
  }
  
  // Bottom edge (y = minY)
  if (direction[1] !== 0) {
    const t = (bounds.minY - point[1]) / direction[1]
    const x = point[0] + t * direction[0]
    if (x >= bounds.minX && x <= bounds.maxX) {
      intersections.push({ t, point: [x, bounds.minY] })
    }
  }
  
  // Top edge (y = maxY)
  if (direction[1] !== 0) {
    const t = (bounds.maxY - point[1]) / direction[1]
    const x = point[0] + t * direction[0]
    if (x >= bounds.minX && x <= bounds.maxX) {
      intersections.push({ t, point: [x, bounds.maxY] })
    }
  }
  
  if (intersections.length < 2) return null
  
  intersections.sort((a, b) => a.t - b.t)
  return {
    start: intersections[0].point,
    end: intersections[intersections.length - 1].point
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function squaredDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return sum
}

/**
 * Build a graph from hex grid neighbor data
 */
export function buildGraphFromNeighbors(
  positions: number[][],
  neighbors: number[][],
  weightFn?: (from: number, to: number) => number
): WeightedGraph {
  const nodes = positions.map((_, i) => i)
  const edges = new Map<number, number[]>()
  const weights = new Map<string, number>()
  
  for (let i = 0; i < neighbors.length; i++) {
    edges.set(i, neighbors[i])
    
    for (const j of neighbors[i]) {
      const weight = weightFn ? weightFn(i, j) : 1
      weights.set(`${i}-${j}`, weight)
    }
  }
  
  return { nodes, edges, weights }
}

/**
 * Analyze territory boundaries using graph theory
 */
export function analyzeTerritorBoundaries(
  infections: Map<number, { photoId: string }>,
  neighbors: number[][]
): {
  boundaries: Map<string, number[]>  // photoId pair -> boundary cell indices
  hotspots: number[]                  // cells with 3+ different neighbors
  frontLength: Map<string, number>    // photoId -> total front length
} {
  const boundaries = new Map<string, number[]>()
  const hotspots: number[] = []
  const frontLength = new Map<string, number>()
  
  for (const [idx, infection] of infections) {
    const cellNeighbors = neighbors[idx] || []
    const neighborPhotos = new Set<string>()
    
    for (const n of cellNeighbors) {
      const nInfection = infections.get(n)
      if (nInfection && nInfection.photoId !== infection.photoId) {
        neighborPhotos.add(nInfection.photoId)
        
        // Create boundary pair key (sorted for consistency)
        const pair = [infection.photoId, nInfection.photoId].sort().join('-')
        if (!boundaries.has(pair)) {
          boundaries.set(pair, [])
        }
        boundaries.get(pair)!.push(idx)
      }
    }
    
    // Update front length
    const frontLen = frontLength.get(infection.photoId) || 0
    frontLength.set(infection.photoId, frontLen + neighborPhotos.size)
    
    // Check for hotspot (contested by 3+ photos)
    if (neighborPhotos.size >= 2) {
      hotspots.push(idx)
    }
  }
  
  return { boundaries, hotspots, frontLength }
}
