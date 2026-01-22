/**
 * Type-safe adapter pattern for converting domain objects to GridItems
 */

import type { GridItem } from './types';

/**
 * Options for adapter conversion
 */
export interface AdapterOptions {
  /**
   * Custom velocity calculation override
   */
  velocity?: number;
  /**
   * Custom visual URL override
   */
  visualUrl?: string;
  /**
   * Additional metadata to merge
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type-safe adapter for converting domain objects to GridItems
 */
export interface ItemAdapter<T> {
  /**
   * Convert a domain object to a GridItem
   */
  toGridItem(data: T, options?: AdapterOptions): GridItem<T>;
  /**
   * Extract the original domain object from a GridItem
   */
  fromGridItem(item: GridItem<T>): T;
  /**
   * Calculate velocity for the item (optional)
   */
  calculateVelocity?(data: T): number;
  /**
   * Extract visual URL for the item (optional)
   */
  extractVisualUrl?(data: T): string | undefined;
}

/**
 * Helper to create adapters for common patterns
 */
export function createAdapter<T>(config: {
  type: string;
  toGridItem: (data: T, options?: AdapterOptions) => GridItem<T>;
  fromGridItem: (item: GridItem<T>) => T;
  calculateVelocity?: (data: T) => number;
  extractVisualUrl?: (data: T) => string | undefined;
}): ItemAdapter<T> {
  return {
    toGridItem: config.toGridItem,
    fromGridItem: config.fromGridItem,
    calculateVelocity: config.calculateVelocity,
    extractVisualUrl: config.extractVisualUrl,
  };
}
