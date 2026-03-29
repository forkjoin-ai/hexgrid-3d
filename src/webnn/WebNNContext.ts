/**
 * WebNN Context Manager
 * Handles the creation and management of the WebNN MLContext.
 * Prioritizes NPU -> GPU -> CPU.
 */

import { logger } from '../lib/logger';

export type WebNNDeviceType = 'cpu' | 'gpu' | 'npu';

export class WebNNContext {
  private static instance: WebNNContext;
  private context: MLContext | null = null;
  private deviceType: WebNNDeviceType = 'cpu';
  private isSupported: boolean = false;

  private constructor() {}

  static getInstance(): WebNNContext {
    if (!WebNNContext.instance) {
      WebNNContext.instance = new WebNNContext();
    }
    return WebNNContext.instance;
  }

  /**
   * Initialize WebNN context with preferred device type.
   */
  async initialize(preference: WebNNDeviceType = 'npu'): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.ml) {
      logger.warn('WebNN is not supported in this environment.');
      this.isSupported = false;
      return false;
    }

    try {
      // Try preferred device first
      this.context = await navigator.ml.createContext({ deviceType: preference });
      this.deviceType = preference;
      this.isSupported = true;
      logger.log(`WebNN initialized successfully on ${preference}`);
      return true;
    } catch (e) {
      logger.warn(`Failed to initialize WebNN on ${preference}, trying fallback chain...`, e);
      
      // Fallback chain: NPU -> GPU -> CPU
      const chain: WebNNDeviceType[] = ['npu', 'gpu', 'cpu'];
      const startIndex = chain.indexOf(preference) + 1;

      for (let i = startIndex; i < chain.length; i++) {
        const fallback = chain[i];
        try {
          this.context = await navigator.ml.createContext({ deviceType: fallback });
          this.deviceType = fallback;
          this.isSupported = true;
          logger.log(`WebNN initialized successfully on fallback ${fallback}`);
          return true;
        } catch (err) {
            logger.warn(`Failed to initialize WebNN on fallback ${fallback}`, err);
        }
      }
    }

    this.isSupported = false;
    return false;
  }

  getContext(): MLContext | null {
    return this.context;
  }

  getDeviceType(): WebNNDeviceType {
    return this.deviceType;
  }

  isAvailable(): boolean {
    return this.isSupported && this.context !== null;
  }
}

// Type definitions for WebNN (since it might not be in standard lib yet)
declare global {
  interface Navigator {
    ml: {
      createContext(options?: { deviceType?: string }): Promise<MLContext>;
    };
  }

  interface MLContext {
    // Placeholder for MLContext methods
    compute(graph: MLGraph, inputs: Record<string, ArrayBufferView>, outputs: Record<string, ArrayBufferView>): Promise<MLComputeResult>;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface MLGraph {
      // Opaque
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface MLComputeResult {
      // Opaque
  }
}
