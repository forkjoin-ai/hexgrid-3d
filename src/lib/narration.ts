export interface NarrationMessage {
  generation: number;
  timestamp: string;
  priority: number;
  text: string;
  eventType?: string;
  sparkline?: string;
}

export class NarrationManager {
  static getInstance(): any {
    return {
      subscribe: () => () => {},
      getState: () => ({})
    };
  }
}

export class NarrationEngine {
  private statsTracker: any;

  constructor(statsTracker: any) {
    this.statsTracker = statsTracker;
  }

  generateNarration(
    generation: number,
    territories: Map<string, number>,
    velocities: Map<string, number>,
    titles: Map<string, string>,
    totalHexes: number,
    availableHexes: number,
    births: number,
    deaths: number
  ): NarrationMessage[] {
    const messages: NarrationMessage[] = [];
    const timestamp = new Date().toISOString();

    if (births > 0 || deaths > 0) {
      messages.push({
        generation,
        timestamp,
        priority: 1,
        text: `Generation ${generation}: ${births} births, ${deaths} deaths`,
        eventType: 'lifecycle',
      });
    }

    return messages;
  }
}
