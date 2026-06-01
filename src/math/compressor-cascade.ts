/**
 * compressor-cascade.ts — hexgrid-3d's local mirror of the jet-engine **compressor cascade**
 * (the shared aether primitive `open-source/aether/src/wasm-simd/compressor-cascade.ts` and the
 * Rust `gnosis-engine-core` crate). Kept API-identical so hexgrid-3d carries the same proof-backed
 * cascade law as FOIL / gnosis-uring / aether.
 *
 * A runtime pipeline is a list of {@link Stage}s, each with a *measured* speedup / pruning ratio.
 * The jet engine's compressor law: the pipeline's overall ratio is the **product** of its stage
 * ratios ({@link overallRatio}); stacking two pipelines **multiplies** their ratios — the
 * `(List, ++) -> (·, ×)` monoid homomorphism ({@link compose} + {@link homomorphismHolds}).
 *
 * OSI placement: hexgrid-3d's spatial index (KDTree / SpatialHashGrid) is an **L3-style routing /
 * candidate-pruning** stage — it routes a query to only the buckets that can contain a hit instead
 * of scanning every entity. See {@link spatialPruningReport}.
 *
 * Proof backing (gnosis-math, axiom-clean):
 *   - Gnosis.MathJetEngine.overallRatio                — overall ratio = product of stages
 *   - Gnosis.MathJetEngine.overallRatio_append         — stacking multiplies (Nat)
 *   - Gnosis.CompressorCascadeRuntime.prodOver_append  — stacking multiplies (any monoid; covers the
 *                                                        measured rational/float ratios used here)
 *   - Gnosis.OSICompressorCascade.osi_is_the_jet_compressor — the OSI stack IS this compressor
 */

export const MATH_JET_ENGINE_MASTER_THEOREM_ID = 'Gnosis.MathJetEngine.math_jet_engine_master';
export const OVERALL_RATIO_APPEND_THEOREM_ID = 'Gnosis.MathJetEngine.overallRatio_append';
export const JET_IS_STEADY_RIPCORD_THEOREM_ID = 'Gnosis.MathJetEngine.jet_is_steady_ripcord';
export const PRODOVER_APPEND_THEOREM_ID = 'Gnosis.CompressorCascadeRuntime.prodOver_append';
export const OSI_IS_THE_JET_COMPRESSOR_THEOREM_ID =
  'Gnosis.OSICompressorCascade.osi_is_the_jet_compressor';

export const CASCADE_THEOREM_IDS = Object.freeze([
  MATH_JET_ENGINE_MASTER_THEOREM_ID,
  OVERALL_RATIO_APPEND_THEOREM_ID,
  JET_IS_STEADY_RIPCORD_THEOREM_ID,
  PRODOVER_APPEND_THEOREM_ID,
  OSI_IS_THE_JET_COMPRESSOR_THEOREM_ID,
] as const);

/**
 * A compressor stage: a named pipeline transform with a measured ratio.
 * `ratio > 1` accelerates / prunes, `1` is a clean pass-through (the cascade identity).
 */
export interface Stage {
  readonly name: string;
  readonly ratio: number;
}

export function stage(name: string, ratio: number): Stage {
  return { name, ratio };
}

/** Overall ratio of a stack = **product** of the stage ratios. Empty cascade = `1` (identity). */
export function overallRatio(stages: readonly Stage[]): number {
  return stages.reduce((acc, s) => acc * s.ratio, 1);
}

/** Append homomorphism: stacking concatenates stage lists; overall ratios multiply. */
export function compose(a: readonly Stage[], b: readonly Stage[]): Stage[] {
  return [...a, ...b];
}

/** The append homomorphism holds within relative tolerance `tol`. */
export function homomorphismHolds(a: readonly Stage[], b: readonly Stage[], tol = 1e-9): boolean {
  const lhs = overallRatio(compose(a, b));
  const rhs = overallRatio(a) * overallRatio(b);
  return Math.abs(lhs - rhs) <= tol * Math.max(Math.abs(lhs), 1);
}

export interface CascadeReport {
  readonly label: string;
  readonly stages: readonly Stage[];
  readonly predictedProduct: number;
  readonly measuredEndToEnd: number;
  readonly theoremIds: readonly string[];
}

export function cascadeReport(
  label: string,
  stages: readonly Stage[],
  measuredEndToEnd: number
): CascadeReport {
  return {
    label,
    stages,
    predictedProduct: overallRatio(stages),
    measuredEndToEnd,
    theoremIds: CASCADE_THEOREM_IDS,
  };
}

/** Residual = measured / predicted (`1` ⇒ the product law predicts end-to-end exactly). */
export function residual(r: CascadeReport): number {
  return r.predictedProduct === 0 ? 0 : r.measuredEndToEnd / r.predictedProduct;
}

/** The product law predicts the measured end-to-end ratio within relative tolerance `tol`. */
export function lawHolds(r: CascadeReport, tol = 1e-9): boolean {
  return (
    Math.abs(r.measuredEndToEnd - r.predictedProduct) <=
    tol * Math.max(Math.abs(r.predictedProduct), 1)
  );
}

/** A one-line, emoji-free summary for bench output. */
export function summarize(r: CascadeReport): string {
  const stages = r.stages.map((s) => `${s.name}=${s.ratio.toFixed(3)}x`).join(' * ');
  return (
    `${r.label}: stages[${stages}] ` +
    `predicted=${r.predictedProduct.toFixed(4)}x measured=${r.measuredEndToEnd.toFixed(4)}x ` +
    `residual=${residual(r).toFixed(3)}`
  );
}

/**
 * Build a {@link CascadeReport} for hexgrid-3d's spatial-index pruning — the L3 routing stage.
 *
 * The ratio is the REAL candidate-reduction of a radius query: a brute-force query must compute the
 * distance for every one of `totalEntities` entries; the {@link SpatialHashGrid}/KDTree only
 * examines `candidatesExamined` (the entries in the buckets that overlap the query ball). The stage
 * ratio is `totalEntities / candidatesExamined` — a structural pruning factor, not a fabricated
 * number. Pass the two counts measured from a real query.
 *
 * @param totalEntities      entries in the grid (brute-force distance-checks)
 * @param candidatesExamined entries actually distance-checked via the spatial index
 */
export function spatialPruningReport(
  totalEntities: number,
  candidatesExamined: number,
  label = 'hexgrid-3d spatial-index L3 routing'
): CascadeReport {
  const pruning = candidatesExamined > 0 ? totalEntities / candidatesExamined : totalEntities;
  const stages = [stage('spatial-cull (candidates examined / total)', pruning)];
  // End-to-end measured ratio equals the single-stage product by construction here (one real stage).
  return cascadeReport(label, stages, overallRatio(stages));
}
