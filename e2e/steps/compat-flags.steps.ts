// Step definitions for e2e/hexgrid-compat-flags.feature.
//
// Direct-call steps against the real compat and features modules — the
// Photo/GridItem round-trip the gallery rides and the flag presets each
// runtime profile ships. No page: hexgrid-3d's BDD surface is its pure
// logic.

import { expect } from '@playwright/test';
import { Given, Then, When } from '@a0n/gnosis/bdd';
import {
  photoToGridItem,
  gridItemToPhoto,
} from '../../src/compat.ts';
import {
  DEFAULT_FEATURE_FLAGS,
  MINIMAL_FEATURE_FLAGS,
  PERFORMANCE_FEATURE_FLAGS,
  mergeFeatureFlags,
  isFeatureEnabled,
  type HexGridFeatureFlags,
} from '../../src/features.ts';
import type { Photo, GridItem } from '../../src/types.ts';

interface World {
  data: Map<string, unknown>;
}

function makePhoto(title: string, category: string): Photo {
  return {
    id: 'photo-1',
    title,
    imageUrl: 'https://img.example/dune.jpg',
    alt: title,
    category,
  };
}

Given<World>(
  'a photo titled {string} in category {string}',
  async (world, title: string, category: string) => {
    world.data.set('photo', makePhoto(title, category));
  }
);

When<World>(
  'the photo is converted to a grid item and back',
  async (world) => {
    const photo = world.data.get('photo') as Photo;
    const recovered = gridItemToPhoto(photoToGridItem(photo));
    world.data.set('recovered', recovered);
  }
);

Then<World>(
  'the recovered photo is the original photo',
  async (world) => {
    const photo = world.data.get('photo') as Photo;
    expect(world.data.get('recovered')).toEqual(photo);
  }
);

When<World>(
  'the photo is converted to a grid item',
  async (world) => {
    const photo = world.data.get('photo') as Photo;
    world.data.set('item', photoToGridItem(photo));
  }
);

Then<World>('the item id is the photo id', async (world) => {
  const photo = world.data.get('photo') as Photo;
  const item = world.data.get('item') as GridItem<Photo>;
  expect(item.id).toBe(photo.id);
});

Then<World>('the item image is the photo image', async (world) => {
  const photo = world.data.get('photo') as Photo;
  const item = world.data.get('item') as GridItem<Photo>;
  expect(item.imageUrl).toBe(photo.imageUrl);
});

Then<World>('the item type is {string}', async (world, type: string) => {
  const item = world.data.get('item') as GridItem<Photo>;
  expect(item.type).toBe(type);
});

When<World>(
  'a bare grid item with an image is converted back',
  async (world) => {
    world.data.set(
      'recovered',
      gridItemToPhoto({
        id: 'bare-1',
        type: 'photo',
        imageUrl: 'https://img.example/bare.jpg',
        data: null,
      } as unknown as GridItem<Photo>)
    );
  }
);

Then<World>('the fallback photo keeps the item id', async (world) => {
  const recovered = world.data.get('recovered') as Photo;
  expect(recovered.id).toBe('bare-1');
  expect(recovered.imageUrl).toBe('https://img.example/bare.jpg');
});

Then<World>(
  'the fallback photo lands in the uncategorized category',
  async (world) => {
    const recovered = world.data.get('recovered') as Photo;
    expect(recovered.category).toBe('uncategorized');
  }
);

When<World>(
  'a bare grid item without an image is converted back',
  async (world) => {
    world.data.set(
      'recovered',
      gridItemToPhoto({
        id: 'bare-2',
        type: 'photo',
        data: null,
      } as unknown as GridItem<Photo>)
    );
  }
);

Then<World>('the conversion yields no photo', async (world) => {
  expect(world.data.get('recovered')).toBeNull();
});

Then<World>('the default preset enables every feature', async () => {
  for (const [feature, enabled] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
    expect(enabled, feature).toBe(true);
  }
});

function presetFlag(
  preset: Required<HexGridFeatureFlags>,
  feature: string
): boolean {
  return preset[feature as keyof HexGridFeatureFlags] === true;
}

Then<World>(
  'the minimal preset enables {string}',
  async (_world, feature: string) => {
    expect(presetFlag(MINIMAL_FEATURE_FLAGS, feature)).toBe(true);
  }
);

Then<World>(
  'the minimal preset disables {string}',
  async (_world, feature: string) => {
    expect(presetFlag(MINIMAL_FEATURE_FLAGS, feature)).toBe(false);
  }
);

Then<World>(
  'the performance preset enables {string}',
  async (_world, feature: string) => {
    expect(presetFlag(PERFORMANCE_FEATURE_FLAGS, feature)).toBe(true);
  }
);

Then<World>(
  'the performance preset disables {string}',
  async (_world, feature: string) => {
    expect(presetFlag(PERFORMANCE_FEATURE_FLAGS, feature)).toBe(false);
  }
);

Then<World>(
  'merging flags that disable {string} keeps {string} enabled',
  async (_world, off: string, on: string) => {
    const merged = mergeFeatureFlags({
      [off]: false,
    } as Partial<HexGridFeatureFlags>);
    expect(merged[on as keyof HexGridFeatureFlags]).toBe(true);
  }
);

Then<World>(
  'merging flags that disable {string} disables {string}',
  async (_world, off: string, same: string) => {
    const merged = mergeFeatureFlags({
      [off]: false,
    } as Partial<HexGridFeatureFlags>);
    expect(merged[same as keyof HexGridFeatureFlags]).toBe(false);
  }
);

Then<World>(
  'a flag object without {string} reports {string} enabled',
  async (_world, absent: string, feature: string) => {
    expect(absent).toBe(feature);
    expect(isFeatureEnabled({}, feature as keyof HexGridFeatureFlags)).toBe(
      true
    );
  }
);

Then<World>(
  'a flag object where {string} is false reports {string} disabled',
  async (_world, off: string, feature: string) => {
    expect(off).toBe(feature);
    expect(
      isFeatureEnabled(
        { [off]: false } as HexGridFeatureFlags,
        feature as keyof HexGridFeatureFlags
      )
    ).toBe(false);
  }
);
