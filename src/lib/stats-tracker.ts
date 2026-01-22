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

  getLeaderboard(limit: number): any[] {
    return [];
  }
}
