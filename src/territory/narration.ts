import type { NarrationMessage } from '../lib/narration';

export type HexwarNarrationEventType =
  | 'claim'
  | 'embed_set'
  | 'delegation_issued'
  | 'delegation_revoked'
  | 'nexus_created'
  | 'nexus_connected'
  | 'alliance_root_bound'
  | 'rally_called'
  | 'allied_border_held'
  | 'alliance_surged'
  | 'unlock'
  | 'tick_surged'
  | 'tick_entrenched'
  | 'leaderboard_flip';

export interface HexwarNarrationEvent {
  id: string;
  eventType: HexwarNarrationEventType;
  occurredAtMs: number;
  actorName?: string;
  cellId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

function priorityForEvent(eventType: HexwarNarrationEventType): number {
  switch (eventType) {
    case 'leaderboard_flip':
    case 'unlock':
      return 9;
    case 'nexus_created':
    case 'nexus_connected':
    case 'alliance_surged':
      return 8;
    case 'tick_surged':
    case 'tick_entrenched':
      return 8;
    case 'rally_called':
    case 'alliance_root_bound':
      return 7;
    case 'claim':
      return 7;
    case 'allied_border_held':
      return 6;
    case 'delegation_issued':
    case 'delegation_revoked':
      return 6;
    case 'embed_set':
      return 5;
    default:
      return 4;
  }
}

function formatSingleEvent(event: HexwarNarrationEvent): string {
  const actor = event.actorName ? `${event.actorName} ` : '';
  const cell = event.cellId ? ` ${event.cellId}` : '';

  switch (event.eventType) {
    case 'claim':
      return `${actor}claimed root${cell}.`.trim();
    case 'embed_set':
      return `${actor}repointed the frontier payload${cell}.`.trim();
    case 'delegation_issued':
      return `${actor}delegated subhex control${cell}.`.trim();
    case 'delegation_revoked':
      return `${actor}revoked delegated control${cell}.`.trim();
    case 'nexus_created':
      return `${actor}founded a nexus${cell}.`.trim();
    case 'nexus_connected':
      return `${actor}connected a sovereign root into an alliance${cell}.`.trim();
    case 'alliance_root_bound':
      return `A sovereign root joined an allied phyle${cell}.`.trim();
    case 'rally_called':
      return `A new rally directive lit up${cell}.`.trim();
    case 'allied_border_held':
      return `Allied borders held firm${cell}.`.trim();
    case 'alliance_surged':
      return `Allied pressure pushed${cell} into surge state.`.trim();
    case 'unlock':
      return `A new latitude band unlocked${cell}.`.trim();
    case 'tick_surged':
      return `Hourly pressure pushed${cell} into surge state.`.trim();
    case 'tick_entrenched':
      return `${cell.trim()} entrenched after the latest tick.`.trim();
    case 'leaderboard_flip':
      return `The leaderboard flipped after the latest tick.`.trim();
    default:
      return 'Frontier activity updated.';
  }
}

export function createHexwarNarrationAdapter(
  events: HexwarNarrationEvent[]
): NarrationMessage[] {
  if (events.length === 0) {
    return [];
  }

  const sorted = [...events].sort(
    (left, right) => left.occurredAtMs - right.occurredAtMs
  );
  const messages: NarrationMessage[] = [];
  let currentBurst: HexwarNarrationEvent[] = [];

  for (const event of sorted) {
    const previous = currentBurst[currentBurst.length - 1];
    const isBurstContinuation =
      previous &&
      previous.eventType === event.eventType &&
      event.occurredAtMs - previous.occurredAtMs <= 30_000;

    if (!isBurstContinuation && currentBurst.length > 0) {
      const first = currentBurst[0];
      messages.push({
        generation: 0,
        timestamp: new Date(first.occurredAtMs).toISOString(),
        priority: priorityForEvent(first.eventType),
        text:
          currentBurst.length === 1
            ? formatSingleEvent(first)
            : `${currentBurst.length} ${first.eventType.replace(/_/g, ' ')} events rippled across the frontier.`,
        eventType: first.eventType,
      });
      currentBurst = [];
    }

    currentBurst.push(event);
  }

  if (currentBurst.length > 0) {
    const first = currentBurst[0];
    messages.push({
      generation: 0,
      timestamp: new Date(first.occurredAtMs).toISOString(),
      priority: priorityForEvent(first.eventType),
      text:
        currentBurst.length === 1
          ? formatSingleEvent(first)
          : `${currentBurst.length} ${first.eventType.replace(/_/g, ' ')} events rippled across the frontier.`,
      eventType: first.eventType,
    });
  }

  return messages;
}
