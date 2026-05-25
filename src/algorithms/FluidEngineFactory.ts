import { StableFluids3D, FluidConfig3D } from './FluidSimulation3D';
import { FluidSimulationWebNN } from './FluidSimulationWebNN';
import { FluidSimulation3DGPU } from './FluidSimulation3DGPU';
import { logger } from '../lib/logger';

export type FluidEngine = StableFluids3D | FluidSimulationWebNN | FluidSimulation3DGPU;

/**
 * Factory to select the best available Fluid Engine.
 * Priority:
 * 1. WebNN (NPU)
 * 2. WebGPU (GPU)
 * 3. CPU (Fallback)
 */
export class FluidEngineFactory {
  static async create(config: FluidConfig3D): Promise<FluidEngine> {
    // 1. Try WebNN
    try {
      const webnn = new FluidSimulationWebNN(config);
      const webnnSupported = await webnn.initialize();
      if (webnnSupported) {
        logger.log("Fluid Engine: Using WebNN (NPU)");
        return webnn;
      }
    } catch (e: unknown) {
      logger.warn("Fluid Engine: WebNN init failed", e);
    }

    // 2. Try WebGPU
    try {
      const webgpu = new FluidSimulation3DGPU(config);
      const webgpuSupported = await webgpu.initialize();
      if (webgpuSupported) {
        logger.log("Fluid Engine: Using WebGPU");
        return webgpu;
      }
    } catch (e: unknown) {
      logger.warn("Fluid Engine: WebGPU init failed", e);
    }

    // 3. Fallback to CPU
    logger.log("Fluid Engine: using CPU Fallback");
    return new StableFluids3D(config);
  }
}
