import { describe, expect, it } from 'bun:test';
import {
  createHexwarNarrationAdapter,
  generateCanonicalHexGlobe,
} from '../../src/territory';
import { calculateAutoTileRadiusByRow } from '../../src/territory/globe';

const TEST_CONFIG = {
  boardId: 'main',
  curveUDeg: 360,
  curveVDeg: 180,
  rowCount: 24,
  equatorColumns: 36,
  minimumColumnsPerRow: 8,
  poleMinScale: 0.25,
};

const DENSE_TEST_CONFIG = {
  boardId: 'dense',
  curveUDeg: 360,
  curveVDeg: 180,
  rowCount: 180,
  equatorColumns: 288,
  minimumColumnsPerRow: 24,
  poleMinScale: 0.25,
  sphereRadius: 1.85,
};

describe('territory globe', () => {
  it('generates a deterministic canonical board', () => {
    const first = generateCanonicalHexGlobe(TEST_CONFIG);
    const second = generateCanonicalHexGlobe(TEST_CONFIG);

    expect(first.configHash).toBe(second.configHash);
    expect(first.cells.length).toBe(second.cells.length);
    expect(first.cells[0]?.cellId).toBe(second.cells[0]?.cellId);
    expect(first.cells.at(-1)?.cellId).toBe(second.cells.at(-1)?.cellId);
  });

  it('assigns stable cell ids and neighbors', () => {
    const board = generateCanonicalHexGlobe(TEST_CONFIG);
    const sample = board.cells.find((cell) => cell.cellId === 'main:r12:c18');

    expect(sample).toBeDefined();
    expect(sample?.neighborCellIds.length).toBeGreaterThanOrEqual(4);
    expect(sample?.neighborCellIds.every((id) => id.startsWith('main:r'))).toBe(
      true
    );
  });

  it('calculates safe auto-fit tile radii for dense equator rows', () => {
    const board = generateCanonicalHexGlobe(DENSE_TEST_CONFIG);
    const rowRadii = calculateAutoTileRadiusByRow(board.cells);

    expect(rowRadii.get(0)).toBeLessThan(1e-12);
    expect(rowRadii.get(89)).toBeDefined();
    expect(rowRadii.get(90)).toBeDefined();
    expect(rowRadii.get(89)).toBeLessThan(0.028);
    expect(rowRadii.get(89)).toBeGreaterThan(0.02);
    expect(rowRadii.get(89)).toBeCloseTo(rowRadii.get(90) ?? 0, 6);
  });
});

describe('territory narration', () => {
  it('coalesces bursty frontier events into a single narration item', () => {
    const messages = createHexwarNarrationAdapter([
      {
        id: 'evt-1',
        eventType: 'claim',
        occurredAtMs: 1000,
        actorName: 'Alice',
        cellId: 'main:r1:c1',
      },
      {
        id: 'evt-2',
        eventType: 'claim',
        occurredAtMs: 20_000,
        actorName: 'Bob',
        cellId: 'main:r1:c2',
      },
      {
        id: 'evt-3',
        eventType: 'unlock',
        occurredAtMs: 80_000,
      },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.text).toContain('2 claim events');
    expect(messages[1]?.priority).toBe(9);
    expect(messages[1]?.text).toContain('latitude band unlocked');
  });
});
