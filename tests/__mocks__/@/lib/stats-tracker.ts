export class StatsTracker {
  trackEvent = jest.fn();
  getPoolStats = jest.fn();
  getAllTimeRecords = jest.fn();
  getLeaderboard = jest.fn();
}

export const globalStatsTracker = new StatsTracker();
