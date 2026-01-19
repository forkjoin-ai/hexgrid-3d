// Main package exports
export * from './components'
export * from './stores'
export * from './features'

// Export pure mathematical functions
export * from './workers/hexgrid-math'
export * from './utils/image-utils'

// Export additional types that aren't in components/stores
export type { WorkerDebug, Photo, GridItem } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED HEXGRID EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// Math library
export * from './math'

// Algorithms (graph, clustering, flow, particles, fluid)
export * from './algorithms'

// WASM acceleration layer
export * from './wasm'

// Unified Snapshot API
export * from './Snapshot'

// Enhanced HexGrid engine with all features integrated
export * from './HexGridEnhanced'
