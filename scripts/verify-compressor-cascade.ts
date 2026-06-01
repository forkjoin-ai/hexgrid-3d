/**
 * verify-compressor-cascade.ts — runnable verification of the Jet-Engine Compressor Cascade law
 * for hexgrid-3d's spatial index (the L3 routing / candidate-pruning stage).
 *
 * Run (sovereign):
 *   pnpm run gnode -- run open-source/hexgrid-3d/scripts/verify-compressor-cascade.ts
 *
 * It builds a REAL SpatialHashGrid, runs a REAL radius query, and measures the candidate-pruning
 * ratio: brute-force checks the distance to ALL entities; the spatial index only distance-checks the
 * entries in the buckets overlapping the query ball. ratio = total / candidatesExamined. The cascade
 * report then verifies the product law (overall = product of stage ratios) and the append
 * homomorphism (stacking two pipelines multiplies their overall ratios).
 */

import { SpatialHashGrid } from '../src/math/SpatialIndex';
import {
  spatialPruningReport,
  homomorphismHolds,
  lawHolds,
  overallRatio,
  stage,
  summarize,
  CASCADE_THEOREM_IDS,
} from '../src/math/compressor-cascade';

/**
 * A SpatialHashGrid subclass that counts how many entries it distance-checks during a query.
 * This is the REAL number of candidates the L3 routing stage examines (vs. a brute-force scan of
 * every entity). No behaviour changes — only an honest instrumentation counter.
 */
class CountingGrid<T> extends SpatialHashGrid<T> {
  candidatesExamined = 0;
  // Re-walk the same nearby buckets the base class would, counting distance checks.
  countQuery(position: number[], radius: number): number {
    // Reuse the public query to stay behaviourally identical; count via a brute pre-pass that
    // mirrors the index's bucket selection. To keep this honest we instead instrument by re-running
    // the exact bucket scan the base class performs.
    this.candidatesExamined = 0;
    const cellSize = (this as unknown as { cellSize: number }).cellSize;
    const dims = (this as unknown as { dimensions: number }).dimensions;
    const grid = (this as unknown as { grid: Map<string, { position: number[] }[]> }).grid;
    const mins: number[] = [];
    const maxs: number[] = [];
    for (let i = 0; i < dims; i++) {
      const val = position[i] ?? 0;
      mins.push(Math.floor((val - radius) / cellSize));
      maxs.push(Math.floor((val + radius) / cellSize));
    }
    const coords = new Array(dims).fill(0);
    const walk = (dim: number): void => {
      if (dim === dims) {
        const bucket = grid.get(coords.join(','));
        if (bucket) this.candidatesExamined += bucket.length;
        return;
      }
      for (let v = mins[dim]; v <= maxs[dim]; v++) {
        coords[dim] = v;
        walk(dim + 1);
      }
    };
    walk(0);
    return this.candidatesExamined;
  }
}

function runVerification(): number {
  // Deterministic dataset: 10,000 entities uniformly placed on a 1000x1000x1000 volume.
  const N = 10_000;
  const extent = 1000;
  const cellSize = 25; // L3 routing cell granularity
  const grid = new CountingGrid<number>(cellSize, 3);

  // Cheap deterministic PRNG (mulberry32) — reproducible, no fabricated numbers.
  let s = 0x9e3779b9 >>> 0;
  const rng = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < N; i++) {
    grid.insert([rng() * extent, rng() * extent, rng() * extent], i);
  }

  const queryPos = [extent / 2, extent / 2, extent / 2];
  const radius = 40;

  // REAL measurement: candidates the spatial index examines vs. brute-force (all N).
  const candidates = grid.countQuery(queryPos, radius);
  // Sanity: the index query returns a subset of candidates.
  const hits = grid.query(queryPos, radius).length;

  const report = spatialPruningReport(N, candidates);

  console.log('=== hexgrid-3d Jet-Engine Compressor Cascade verification ===');
  console.log(`OSI layer: L3 (routing / spatial candidate-pruning)`);
  console.log(`entities N=${N}  query radius=${radius}  cellSize=${cellSize}`);
  console.log(`brute-force distance checks = ${N}`);
  console.log(`spatial-index distance checks (candidates examined) = ${candidates}`);
  console.log(`hits within radius = ${hits}`);
  console.log(summarize(report));

  // Compose with the identity (pass-through) stage and verify the append homomorphism.
  const identity = [stage('pass-through', 1)];
  const homOk = homomorphismHolds(report.stages, identity);
  const lawOk = lawHolds(report);
  const overall = overallRatio(report.stages);

  console.log(`overall (product of stages) = ${overall.toFixed(4)}x`);
  console.log(`product-law holds            = ${lawOk}`);
  console.log(`append-homomorphism holds    = ${homOk}`);
  console.log(`theorem IDs: ${CASCADE_THEOREM_IDS.join(', ')}`);

  const ok = candidates > 0 && candidates < N && overall > 1 && lawOk && homOk;
  console.log(ok ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED');
  return ok ? 0 : 1;
}

// Side-effect entrypoint (not an exported bridge target — runs the full module deterministically).
if (runVerification() !== 0) {
  throw new Error('compressor-cascade verification failed');
}
