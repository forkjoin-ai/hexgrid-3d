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
