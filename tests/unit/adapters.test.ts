import { describe, it, expect } from 'bun:test';
import { createAdapter } from '../../src/adapters';
import type { GridItem } from '../../src/types';

describe('Adapters', () => {
  describe('createAdapter', () => {
    interface TestItem {
      id: string;
      name: string;
      value: number;
    }

    it('creates an adapter with required methods', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'test-item',
          title: data.name,
          data,
        }),
        fromGridItem: (item) => item.data!,
      });

      expect(adapter.toGridItem).toBeDefined();
      expect(adapter.fromGridItem).toBeDefined();
    });

    it('converts domain object to GridItem', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'test-item',
          title: data.name,
          description: `Value: ${data.value}`,
          data,
        }),
        fromGridItem: (item) => item.data!,
      });

      const testData: TestItem = { id: 'test-1', name: 'Test', value: 42 };
      const gridItem = adapter.toGridItem(testData);

      expect(gridItem.id).toBe('test-1');
      expect(gridItem.type).toBe('test-item');
      expect(gridItem.title).toBe('Test');
      expect(gridItem.description).toBe('Value: 42');
      expect(gridItem.data).toBe(testData);
    });

    it('extracts domain object from GridItem', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'test-item',
          data,
        }),
        fromGridItem: (item) => item.data!,
      });

      const testData: TestItem = { id: 'test-1', name: 'Test', value: 42 };
      const gridItem = adapter.toGridItem(testData);
      const extracted = adapter.fromGridItem(gridItem);

      expect(extracted).toBe(testData);
      expect(extracted.id).toBe('test-1');
      expect(extracted.name).toBe('Test');
      expect(extracted.value).toBe(42);
    });

    it('supports optional calculateVelocity', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'test-item',
          data,
        }),
        fromGridItem: (item) => item.data!,
        calculateVelocity: (data) => data.value / 100,
      });

      const testData: TestItem = { id: 'test-1', name: 'Test', value: 50 };
      expect(adapter.calculateVelocity!(testData)).toBe(0.5);
    });

    it('supports optional extractVisualUrl', () => {
      interface VisualItem extends TestItem {
        imageUrl?: string;
      }

      const adapter = createAdapter<VisualItem>({
        type: 'visual-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'visual-item',
          imageUrl: data.imageUrl,
          data,
        }),
        fromGridItem: (item) => item.data!,
        extractVisualUrl: (data) => data.imageUrl,
      });

      const testData: VisualItem = {
        id: 'test-1',
        name: 'Test',
        value: 42,
        imageUrl: 'https://example.com/image.jpg',
      };
      expect(adapter.extractVisualUrl!(testData)).toBe(
        'https://example.com/image.jpg'
      );
    });

    it('applies AdapterOptions when converting', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data, options) => ({
          id: data.id,
          type: 'test-item',
          title: data.name,
          imageUrl: options?.visualUrl,
          data: {
            ...data,
            ...(options?.metadata as Partial<TestItem>),
          },
        }),
        fromGridItem: (item) => item.data!,
      });

      const testData: TestItem = { id: 'test-1', name: 'Test', value: 42 };
      const gridItem = adapter.toGridItem(testData, {
        visualUrl: 'https://override.com/image.jpg',
        metadata: { value: 100 },
      });

      expect(gridItem.imageUrl).toBe('https://override.com/image.jpg');
      expect(gridItem.data?.value).toBe(100);
    });

    it('handles undefined data in GridItem', () => {
      const adapter = createAdapter<TestItem>({
        type: 'test-item',
        toGridItem: (data) => ({
          id: data.id,
          type: 'test-item',
          data,
        }),
        fromGridItem: (item) => item.data || { id: '', name: '', value: 0 },
      });

      const gridItem: GridItem<TestItem> = {
        id: 'empty',
        type: 'test-item',
        // data is undefined
      };

      const extracted = adapter.fromGridItem(gridItem);
      expect(extracted.id).toBe('');
    });
  });
});
