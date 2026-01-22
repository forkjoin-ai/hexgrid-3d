import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { uiStore } from '../../src/stores/uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    uiStore.set({
      debugOpen: false,
      showStats: false,
      cameraOpen: false,
      showNarration: false,
    });
  });

  it('initializes with default state', () => {
    const state = uiStore.getState();
    expect(state.debugOpen).toBe(false);
    expect(state.showStats).toBe(false);
    expect(state.cameraOpen).toBe(false);
  });

  it('toggles debug state', () => {
    let currentState: any = null;
    const unsubscribe = uiStore.subscribe((state) => {
      currentState = state;
    });

    uiStore.toggleDebug();
    expect(currentState?.debugOpen).toBe(true);

    uiStore.toggleDebug();
    expect(currentState?.debugOpen).toBe(false);

    unsubscribe();
  });

  it('toggles stats state', () => {
    let currentState: any = null;
    const unsubscribe = uiStore.subscribe((state) => {
      currentState = state;
    });

    uiStore.toggleStats();
    expect(currentState?.showStats).toBe(true);

    uiStore.toggleStats();
    expect(currentState?.showStats).toBe(false);

    unsubscribe();
  });

  it('toggles camera state', () => {
    let currentState: any = null;
    const unsubscribe = uiStore.subscribe((state) => {
      currentState = state;
    });

    uiStore.toggleCamera();
    expect(currentState?.cameraOpen).toBe(true);

    uiStore.toggleCamera();
    expect(currentState?.cameraOpen).toBe(false);

    unsubscribe();
  });

  it('toggles narration state', () => {
    let currentState: any = null;
    const unsubscribe = uiStore.subscribe((state) => {
      currentState = state;
    });

    uiStore.toggleNarration();
    expect(currentState?.showNarration).toBe(true);

    uiStore.toggleNarration();
    expect(currentState?.showNarration).toBe(false);

    unsubscribe();
  });

  it('updates multiple state values at once', () => {
    let currentState: any = null;
    const unsubscribe = uiStore.subscribe((state) => {
      currentState = state;
    });

    uiStore.set({
      debugOpen: true,
      showStats: true,
    });

    expect(currentState?.debugOpen).toBe(true);
    expect(currentState?.showStats).toBe(true);
    expect(currentState?.cameraOpen).toBe(false);
    expect(currentState?.showNarration).toBe(false);

    unsubscribe();
  });

  it('notifies all subscribers', () => {
    const subscriber1 = mock(() => {});
    const subscriber2 = mock(() => {});

    const unsubscribe1 = uiStore.subscribe(subscriber1);
    const unsubscribe2 = uiStore.subscribe(subscriber2);

    // Initial call on subscribe
    expect(subscriber1).toHaveBeenCalledTimes(1);
    expect(subscriber2).toHaveBeenCalledTimes(1);

    uiStore.toggleDebug();

    expect(subscriber1).toHaveBeenCalledTimes(2);
    expect(subscriber2).toHaveBeenCalledTimes(2);

    unsubscribe1();
    unsubscribe2();
  });

  it('removes subscriber after unsubscribe', () => {
    const subscriber = mock(() => {});
    const unsubscribe = uiStore.subscribe(subscriber);

    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
    uiStore.toggleDebug();

    // Should still be 1 (only initial call)
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('persists showNarration to localStorage', () => {
    // First set showNarration
    uiStore.set({ showNarration: true });

    // Check localStorage was updated
    const saved = window.localStorage.getItem('hexgrid.showNarration');
    expect(saved).toBe('true');

    // Toggle off
    uiStore.set({ showNarration: false });
    const savedFalse = window.localStorage.getItem('hexgrid.showNarration');
    expect(savedFalse).toBe('false');
  });

  it('does not notify when setting same values', () => {
    const subscriber = mock(() => {});
    const unsubscribe = uiStore.subscribe(subscriber);

    // Initial call
    expect(subscriber).toHaveBeenCalledTimes(1);

    // Set same values - should not trigger notification
    uiStore.set({
      debugOpen: false,
      showStats: false,
    });

    // Still 1 because values didn't change
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('returns state copy from getState', () => {
    const state1 = uiStore.getState();
    const state2 = uiStore.getState();

    // Should be different objects
    expect(state1).not.toBe(state2);
    // But equal values
    expect(state1).toEqual(state2);
  });

  it('handles localStorage errors gracefully on set', () => {
    // Mock localStorage.setItem to throw
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('Quota exceeded');
    };

    // Should not throw when localStorage fails
    expect(() => {
      uiStore.set({ showNarration: true });
    }).not.toThrow();

    // Restore
    window.localStorage.setItem = originalSetItem;
  });

  it('handles localStorage errors gracefully on get', () => {
    // Mock localStorage.getItem to throw
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('Access denied');
    };

    // getState should still work
    expect(() => {
      uiStore.getState();
    }).not.toThrow();

    // Restore
    window.localStorage.getItem = originalGetItem;
  });
});
