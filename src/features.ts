/**
 * Feature flags for HexGrid 3D
 *
 * Allows enabling/disabling features at runtime for different client environments
 */

export interface HexGridFeatureFlags {
  /** Enable/disable play-by-play narration overlay */
  enableNarration?: boolean;

  /** Enable/disable statistics tracking and display */
  enableStats?: boolean;

  /** Enable/disable debug panel */
  enableDebugPanel?: boolean;

  /** Enable/disable camera controls UI */
  enableCameraControls?: boolean;

  /** Enable/disable worker-based rendering */
  enableWorker?: boolean;

  /** Enable/disable texture/image loading */
  enableTextures?: boolean;

  /** Enable/disable evolution/animation system */
  enableEvolution?: boolean;

  /** Enable/disable autoplay functionality */
  enableAutoplay?: boolean;

  /** Enable/disable user interactions (clicks, drags) */
  enableInteractions?: boolean;

  /** Enable/disable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;

  /** Enable/disable performance telemetry */
  enableTelemetry?: boolean;

  /** Enable/disable sheen/visual effects */
  enableVisualEffects?: boolean;

  /** Enable/disable leaderboard system */
  enableLeaderboard?: boolean;
}

/**
 * Default feature flags - all features enabled
 */
export const DEFAULT_FEATURE_FLAGS: Required<HexGridFeatureFlags> = {
  enableNarration: true,
  enableStats: true,
  enableDebugPanel: true,
  enableCameraControls: true,
  enableWorker: true,
  enableTextures: true,
  enableEvolution: true,
  enableAutoplay: true,
  enableInteractions: true,
  enableKeyboardShortcuts: true,
  enableTelemetry: true,
  enableVisualEffects: true,
  enableLeaderboard: true,
};

/**
 * Minimal feature flags - only core visualization
 */
export const MINIMAL_FEATURE_FLAGS: Required<HexGridFeatureFlags> = {
  enableNarration: false,
  enableStats: false,
  enableDebugPanel: false,
  enableCameraControls: false,
  enableWorker: true,
  enableTextures: true,
  enableEvolution: false,
  enableAutoplay: false,
  enableInteractions: true,
  enableKeyboardShortcuts: false,
  enableTelemetry: false,
  enableVisualEffects: false,
  enableLeaderboard: false,
};

/**
 * Performance-focused feature flags
 */
export const PERFORMANCE_FEATURE_FLAGS: Required<HexGridFeatureFlags> = {
  enableNarration: false,
  enableStats: true,
  enableDebugPanel: false,
  enableCameraControls: true,
  enableWorker: true,
  enableTextures: true,
  enableEvolution: true,
  enableAutoplay: false,
  enableInteractions: true,
  enableKeyboardShortcuts: true,
  enableTelemetry: false,
  enableVisualEffects: false,
  enableLeaderboard: false,
};

/**
 * Merge user-provided flags with defaults
 */
export function mergeFeatureFlags(
  userFlags?: Partial<HexGridFeatureFlags>
): Required<HexGridFeatureFlags> {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...userFlags,
  };
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  flags: HexGridFeatureFlags,
  feature: keyof HexGridFeatureFlags
): boolean {
  return flags[feature] !== false;
}
