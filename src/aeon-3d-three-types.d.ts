export * from 'three';
import type { WebGLRenderer, WebGLRendererParameters } from 'three';

export function createRendererSync(
  parameters?: WebGLRendererParameters
): WebGLRenderer;
