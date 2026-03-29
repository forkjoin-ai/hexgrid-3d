type UIState = {
  debugOpen: boolean;
  showStats: boolean;
  cameraOpen?: boolean;
  showNarration?: boolean;
};

// Safe localStorage helpers that never throw
const safeGetItem = (key: string): string | null => {
  // istanbul ignore next
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // istanbul ignore next
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  // istanbul ignore next
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // istanbul ignore next - private browsing, quota exceeded
  }
};

// Initialize showNarration from localStorage if available
const savedNarration = safeGetItem('hexgrid.showNarration');
const initialShowNarration = savedNarration === 'true';

const state: UIState = {
  debugOpen: false,
  showStats: false,
  cameraOpen: false,
  showNarration: initialShowNarration,
};

const listeners = new Set<(s: UIState) => void>();

const uiStore = {
  getState(): UIState {
    return { ...state };
  },
  set(partial: Partial<UIState>) {
    let changed = false;
    for (const k of Object.keys(partial) as (keyof UIState)[]) {
      if (partial[k] !== undefined && state[k] !== partial[k]) {
        (state as Record<string, unknown>)[k] = partial[k];
        changed = true;
      }
    }
    if (changed) {
      // Persist showNarration to localStorage for cross-refresh consistency
      if (partial.showNarration !== undefined) {
        safeSetItem('hexgrid.showNarration', String(!!partial.showNarration));
      }
      for (const cb of Array.from(listeners)) cb({ ...state });
    }
  },
  subscribe(cb: (s: UIState) => void) {
    listeners.add(cb);
    // emit current immediately
    cb({ ...state });
    return () => listeners.delete(cb);
  },
  toggleDebug() {
    this.set({ debugOpen: !state.debugOpen });
  },
  toggleStats() {
    this.set({ showStats: !state.showStats });
  },
  toggleCamera() {
    this.set({ cameraOpen: !state.cameraOpen });
  },
  toggleNarration() {
    this.set({ showNarration: !state.showNarration });
  },
};

export { uiStore };
export default uiStore;
