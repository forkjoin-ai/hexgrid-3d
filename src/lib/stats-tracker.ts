export class StatsTracker {
  static getInstance(): StatsTracker {
    return new StatsTracker();
  }

  getCurrentStats(): any {
    return {
      generation: 1,
      activeMemesCount: 10,
      totalHexesInfected: 100,
      populationStability: 0.5
    };
  }

  getAllTimeRecords(): any {
    return {
      highestTerritory: { value: 100 },
      longestSurvivalStreak: { value: 50 }
    };
  }

  getLeaderboard(_limit: number): any[] {
    return [];
  }

  importState(json: any): void {
    // Restore state from serialized JSON
    if (json && typeof json === 'object') {
      Object.assign(this, json);
    }
  }

  exportState(): any {
    return {
      generation: this.getCurrentStats().generation,
      stats: this.getCurrentStats(),
      records: this.getAllTimeRecords(),
    };
  }
}
