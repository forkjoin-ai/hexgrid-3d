type UIState = {
  debugOpen: boolean
  showStats: boolean
  cameraOpen?: boolean
  showNarration?: boolean
}

// Initialize showNarration from localStorage if available
let initialShowNarration = false
try {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('hexgrid.showNarration')
    if (saved !== null) {
      initialShowNarration = saved === 'true'
    }
  }
} catch (err) {
  // ignore localStorage failures
}

const state: UIState = {
  debugOpen: false,
  showStats: false,
  cameraOpen: false,
  showNarration: initialShowNarration
}

const listeners = new Set<(s: UIState) => void>()

const uiStore = {
  getState(): UIState {
    return { ...state }
  },
  set(partial: Partial<UIState>) {
    let changed = false
    for (const k of Object.keys(partial) as (keyof UIState)[]) {
      if (partial[k] !== undefined && state[k] !== partial[k]) {
        // @ts-ignore
        state[k] = partial[k]
        changed = true
      }
    }
    if (changed) {
      // Persist showNarration to localStorage for cross-refresh consistency
      try {
        if (typeof window !== 'undefined' && partial.showNarration !== undefined) {
          window.localStorage.setItem('hexgrid.showNarration', String(!!partial.showNarration))
        }
      } catch (err) {
        // ignore localStorage failures
      }
      for (const cb of Array.from(listeners)) cb({ ...state })
    }
  },
  subscribe(cb: (s: UIState) => void) {
    listeners.add(cb)
    // emit current immediately
    cb({ ...state })
    return () => listeners.delete(cb)
  },
  toggleDebug() {
    this.set({ debugOpen: !state.debugOpen })
  },
  toggleStats() {
    this.set({ showStats: !state.showStats })
  },
  toggleCamera() {
    this.set({ cameraOpen: !state.cameraOpen })
  },
  toggleNarration() {
    this.set({ showNarration: !state.showNarration })
  }
}

export { uiStore }
export default uiStore
