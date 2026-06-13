import React from '@a0n/raect'

export interface PoolStatsOverlayProps {
  isOpen: boolean
}

export function PoolStatsOverlay({ isOpen }: PoolStatsOverlayProps): React.JSX.Element | null {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#0ff',
        padding: '8px 12px',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      Pool Stats Overlay
    </div>
  )
}
