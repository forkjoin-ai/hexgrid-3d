/**
 * Adapter for embedding ontology entities directly in the grid
 *
 * This adapter allows ontology entities from @emotions-app/shared-utils/ontology
 * to be embedded directly in GridItems with full metadata preservation.
 */

import type { OntologyEntity } from '@emotions-app/shared-utils/ontology/types';
import type { GridItem } from './types';
import type { ItemAdapter, AdapterOptions } from './adapters';

/**
 * Calculate velocity for an ontology entity based on provenance confidence
 * and recency
 */
function calculateEntityVelocity(entity: OntologyEntity): number {
  let velocity = 0.1; // Base minimum

  // Use provenance confidence (0-1) as primary factor
  const confidence = entity.metadata.provenance.confidence;
  velocity += confidence * 0.5;

  // Recency factor based on lastModified
  if (entity.metadata.lastModified) {
    const ageMs = Date.now() - new Date(entity.metadata.lastModified).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recencyFactor = Math.max(0, 1 - ageHours / 168); // Decay over 1 week
    velocity += recencyFactor * 0.4;
  }

  // Clamp to [0.1, 1.0]
  return Math.max(0.1, Math.min(1.0, velocity));
}

/**
 * Adapter for embedding ontology entities directly
 */
export const ontologyEntityAdapter: ItemAdapter<OntologyEntity> = {
  toGridItem(
    entity: OntologyEntity,
    options?: AdapterOptions
  ): GridItem<OntologyEntity> {
    const velocity = options?.velocity ?? calculateEntityVelocity(entity);

    return {
      id: entity['@id'],
      type: 'ontology-entity',
      title: entity.label,
      description:
        (entity.properties.description as string | undefined) || entity.label,
      data: entity,
      ontologyMetadata: {
        entityId: entity['@id'],
        entityType: Array.isArray(entity['@type'])
          ? entity['@type']
          : [entity['@type']],
        properties: entity.properties,
        provenance: entity.metadata.provenance,
      },
      velocity,
      createdAt:
        entity.metadata.lastModified || entity.metadata.provenance.extractedAt,
      // Extract visual URL if available in properties
      imageUrl:
        options?.visualUrl ||
        (entity.properties.imageUrl as string | undefined),
    };
  },

  fromGridItem(item: GridItem<OntologyEntity>): OntologyEntity {
    if (!item.data) {
      throw new Error('GridItem missing ontology entity data');
    }
    return item.data;
  },

  calculateVelocity(entity: OntologyEntity): number {
    return calculateEntityVelocity(entity);
  },

  extractVisualUrl(entity: OntologyEntity): string | undefined {
    return entity.properties.imageUrl as string | undefined;
  },
};
