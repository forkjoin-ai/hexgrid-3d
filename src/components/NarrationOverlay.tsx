/**
 * Narration Overlay Component
 *
 * Displays play-by-play narration messages with sparklines in a NOC dashboard style.
 */

import React, { useEffect, useRef } from '@a0n/raect';
import { NarrationMessage } from '../lib/narration';
import { StatsTracker } from '../lib/stats-tracker';
import { getAccentRgba, getAccentHex } from '../lib/theme-colors';

export interface NarrationOverlayProps {
  messages: NarrationMessage[];
  statsTracker: StatsTracker | null;
  isVisible: boolean;
  onClose: () => void;
}

export const NarrationOverlay: React.FC<NarrationOverlayProps> = ({
  messages,
  statsTracker,
  isVisible,
  onClose,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Always render the overlay so fade-out can animate smoothly.
  // Toggle visibility via styles.

  const currentStats = statsTracker?.getCurrentStats();
  const allTimeRecords = statsTracker?.getAllTimeRecords();
  const leaderboard = statsTracker?.getLeaderboard(10);

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        top: 80,
        width: 400,
        maxHeight: 'calc(100vh - 100px)',
        background: 'rgba(0, 0, 0, 0.85)',
        border: `1px solid ${getAccentRgba(0.3)}`,
        borderRadius: 8,
        padding: '12px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        color: getAccentHex(),
        boxShadow: `0 0 20px ${getAccentRgba(0.2)}`,
        // Fade transition
        transition: 'opacity 220ms ease, transform 220ms ease',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0px)' : 'translateY(-6px)',
        pointerEvents: isVisible ? ('auto' as const) : ('none' as const),
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: 14 }}>
          Play-by-Play Narration
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            color: '#00ffff',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          ×
        </button>
      </div>

      {/* Stats Dashboard (Collapsible) */}
      {currentStats && (
        <details style={{ marginBottom: 8, fontSize: 11 }}>
          <summary
            style={{ cursor: 'pointer', color: '#00ffff', marginBottom: 4 }}
          >
            Stats Dashboard
          </summary>
          <div
            style={{
              padding: '8px',
              background: 'rgba(0, 255, 255, 0.05)',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span>Generation:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentStats.generation}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span>Active Memes:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentStats.activeMemesCount}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span>Total Hexes:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentStats.totalHexesInfected}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span>Birth/Death Ratio:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentStats.populationStability.toFixed(2)}
              </span>
            </div>
            {allTimeRecords && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(0, 255, 255, 0.2)',
                }}
              >
                <div
                  style={{ fontSize: 10, color: '#00ffff', marginBottom: 4 }}
                >
                  All-Time Records:
                </div>
                <div style={{ fontSize: 10, marginBottom: 2 }}>
                  Highest Territory: {allTimeRecords.highestTerritory.value}
                </div>
                <div style={{ fontSize: 10, marginBottom: 2 }}>
                  Longest Streak: {allTimeRecords.longestSurvivalStreak.value}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Leaderboard (Collapsible) */}
      {leaderboard && leaderboard.length > 0 && (
        <details style={{ marginBottom: 8, fontSize: 11 }}>
          <summary
            style={{ cursor: 'pointer', color: '#00ffff', marginBottom: 4 }}
          >
            Top 10 Leaderboard
          </summary>
          <div
            style={{
              padding: '8px',
              background: 'rgba(0, 255, 255, 0.05)',
              borderRadius: 4,
            }}
          >
            {leaderboard.map((entry: any, i: number) => (
              <div
                key={entry.photoId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                  fontSize: 10,
                  color: i < 3 ? '#00ff00' : '#00ffff',
                }}
              >
                <span>
                  {i + 1}. {entry.photoId.slice(0, 20)}...
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {entry.territory} hexes
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '400px',
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 4,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              color: 'rgba(0, 255, 255, 0.5)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '20px',
            }}
          >
            No narration yet. Evolution in progress...
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.generation}-${index}`}
              style={{
                marginBottom: 8,
                padding: '6px',
                background:
                  msg.priority >= 8
                    ? 'rgba(255, 165, 0, 0.1)'
                    : 'rgba(0, 255, 255, 0.05)',
                borderRadius: 4,
                borderLeft: `2px solid ${
                  msg.priority >= 8 ? '#ffaa00' : '#00ffff'
                }`,
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2,
                }}
              >
                <span style={{ color: 'rgba(0, 255, 255, 0.7)', fontSize: 10 }}>
                  Gen {msg.generation}
                </span>
                <span style={{ color: 'rgba(0, 255, 255, 0.5)', fontSize: 9 }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontFamily: "'Courier New', monospace" }}>
                {msg.text}
                {msg.sparkline && (
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: "'Courier New', monospace",
                      fontSize: 14,
                      color:
                        msg.eventType === 'slam_dunk' ||
                        msg.eventType === 'on_fire'
                          ? '#00ff00'
                          : msg.eventType === 'decline' ||
                            msg.eventType === 'missed_shot'
                          ? '#ff4444'
                          : '#00ffff',
                      letterSpacing: '2px',
                    }}
                  >
                    {msg.sparkline}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
