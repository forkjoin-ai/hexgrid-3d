/**
 * WebGPU Context Manager
 * Handles the creation and management of the WebGPU Device and Adapter.
 */

import { logger } from '../lib/logger';

export class WebGPUContext {
  private static instance: WebGPUContext;
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private isSupported: boolean = false;

  private constructor() {}

  static getInstance(): WebGPUContext {
    if (!WebGPUContext.instance) {
      WebGPUContext.instance = new WebGPUContext();
    }
    return WebGPUContext.instance;
  }

  /**
   * Initialize WebGPU context.
   */
  async initialize(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      logger.warn('WebGPU is not supported in this environment.');
      this.isSupported = false;
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!this.adapter) {
        logger.warn('No WebGPU adapter found.');
        this.isSupported = false;
        return false;
      }

      this.device = await this.adapter.requestDevice();
      
      this.device.lost.then((info) => {
        logger.error(`WebGPU device lost: ${info.message}`);
        this.device = null;
        this.isSupported = false;
      });

      this.isSupported = true;
      logger.log('WebGPU initialized successfully.');
      return true;
    } catch (e: unknown) {
      logger.error('Failed to initialize WebGPU:', e);
      this.isSupported = false;
      return false;
    }
  }

  getDevice(): GPUDevice | null {
    return this.device;
  }

  getAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  isAvailable(): boolean {
    return this.isSupported && this.device !== null;
  }
}
