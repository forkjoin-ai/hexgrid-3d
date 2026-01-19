import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Register happy-dom globals before any tests run
GlobalRegistrator.register()

import '@testing-library/jest-dom'
import { mock } from 'bun:test'
import React from 'react'

// Mock external components that are imported from parent project
mock.module('@/components/debug/PoolStatsOverlay', () => ({
  PoolStatsOverlay: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? React.createElement('div', { 'data-testid': 'pool-stats-mock' }, 'Pool Stats Mock') : null
}))

// Mock fetch to avoid "Failed to construct 'Request'" errors with relative URLs
const originalFetch = globalThis.fetch
globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  
  // If it's a relative URL, just return a mock response
  if (url.startsWith('/')) {
    return Promise.resolve(new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
  }
  
  // For absolute URLs, use original fetch (if available) or mock
  return Promise.resolve(new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }))
}) as typeof fetch

// Mock gradient object
const mockGradient = {
  addColorStop: mock(() => {}),
}

// Mock canvas and WebGL context
const mockContext = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowBlur: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  fillRect: mock(() => {}),
  clearRect: mock(() => {}),
  getImageData: mock(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  putImageData: mock(() => {}),
  createImageData: mock(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  setTransform: mock(() => {}),
  drawImage: mock(() => {}),
  save: mock(() => {}),
  restore: mock(() => {}),
  beginPath: mock(() => {}),
  moveTo: mock(() => {}),
  lineTo: mock(() => {}),
  closePath: mock(() => {}),
  stroke: mock(() => {}),
  translate: mock(() => {}),
  scale: mock(() => {}),
  rotate: mock(() => {}),
  arc: mock(() => {}),
  fill: mock(() => {}),
  measureText: mock(() => ({ width: 0 })),
  transform: mock(() => {}),
  rect: mock(() => {}),
  clip: mock(() => {}),
  createLinearGradient: mock(() => mockGradient),
  createRadialGradient: mock(() => mockGradient),
  createPattern: mock(() => null),
  strokeRect: mock(() => {}),
  strokeText: mock(() => {}),
  fillText: mock(() => {}),
  bezierCurveTo: mock(() => {}),
  quadraticCurveTo: mock(() => {}),
  arcTo: mock(() => {}),
  ellipse: mock(() => {}),
  isPointInPath: mock(() => false),
  isPointInStroke: mock(() => false),
  getLineDash: mock(() => []),
  setLineDash: mock(() => {}),
  getTransform: mock(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  resetTransform: mock(() => {}),
  canvas: { width: 800, height: 600 },
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = mock(() => mockContext) as any
}

// Mock Web Worker
global.Worker = class Worker {
  url: string
  onmessage: ((event: MessageEvent) => void) | null = null
  
  constructor(url: string) {
    this.url = url
  }

  postMessage(_msg: any) {
    // Mock worker behavior
  }

  terminate() {
    // Mock termination
  }
} as any

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
} as any

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any

// Mock requestAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number
  }
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id: number) => {
    clearTimeout(id)
  }
}

// Mock matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mock((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: mock(() => {}),
      removeListener: mock(() => {}),
      addEventListener: mock(() => {}),
      removeEventListener: mock(() => {}),
      dispatchEvent: mock(() => {}),
    })),
  })
}
