export type PoolStats = {
  activeConnections: number
  totalPhotos: number
}

export class StatsTracker {
  getPoolStats() {
    return {
      activeConnections: 0,
      totalPhotos: 0,
    }
  }
  
  getAllTimeRecords() {
    return {}
  }
  
  getLeaderboard() {
    return []
  }
}
