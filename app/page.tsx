'use client';

import { useState, useEffect, useMemo } from 'react';
import { retryWithBackoff } from '@/lib/retry';
import { Player, SortKey, SortDirection, HistoricalSnapshot, SortConfig } from '@/lib/types';
import ErrorDisplay from '@/components/ErrorDisplay';
import LeaderboardTable from '@/components/LeaderboardTable';
import SearchAndFilters from '@/components/SearchAndFilters';
import HistoricalDateSelector from '@/components/HistoricalDateSelector';
import {
  SnapshotListResponseSchema,
  LeaderboardResponseSchema,
  HistoricalDataResponseSchema,
  safeValidate
} from '@/lib/schemas';

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [webpageTimestamp, setWebpageTimestamp] = useState<string>('');
  const [hasPreviousDayData, setHasPreviousDayData] = useState(false);
  const [previousDayDate, setPreviousDayDate] = useState<string | null>(null);
  const [showPreviousDayStats, setShowPreviousDayStats] = useState(true);
  
  // Historical data state
  const [availableDates, setAvailableDates] = useState<HistoricalSnapshot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [showTipSection, setShowTipSection] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAvailableDates();
  }, []);

  const fetchAvailableDates = async () => {
    try {
      await retryWithBackoff(async () => {
        const response = await fetch('/api/history');
        if (!response.ok) {
          throw new Error(`Failed to fetch available dates: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        // Validate the snapshot list response
        const validatedData = safeValidate(
          SnapshotListResponseSchema,
          data,
          'Snapshot list response from /api/history'
        );
        
        if (!validatedData) {
          console.error('Invalid snapshot list data received');
          setAvailableDates([]);
          return;
        }
        
        setAvailableDates(validatedData.snapshots);
      });
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
      // Don't set error state for this, it's not critical
    }
  };

  const fetchData = async (date?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await retryWithBackoff(async () => {
        const url = date ? `/api/history/${date}` : '/api/leaderboard';
        const response = await fetch(url);
        
        if (!response.ok) {
          // Provide more specific error messages based on status code
          if (response.status === 404) {
            throw new Error(date
              ? `Historical data not found for ${date}`
              : 'Leaderboard data not found'
            );
          } else if (response.status === 500) {
            throw new Error('Server error - please try again later');
          } else if (response.status >= 400 && response.status < 500) {
            throw new Error(`Client error: ${response.status} ${response.statusText}`);
          } else {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
          }
        }
        
        const data = await response.json();
        
        // Validate the response based on whether it's historical or current data
        if (date) {
          // Historical data validation
          const validatedData = safeValidate(
            HistoricalDataResponseSchema,
            data,
            `Historical data response from /api/history/${date}`
          );
          
          if (!validatedData) {
            throw new Error('Invalid historical data received from server');
          }
          
          setPlayers(validatedData.players);
          setLastUpdated(validatedData.capturedAt);
          setWebpageTimestamp(validatedData.webpageTimestamp);
          setHasPreviousDayData(validatedData.hasPreviousDayData);
          setPreviousDayDate(validatedData.previousDayDate || null);
          setIsHistoricalView(validatedData.isHistorical);
        } else {
          // Current leaderboard data validation
          const validatedData = safeValidate(
            LeaderboardResponseSchema,
            data,
            'Leaderboard data response from /api/leaderboard'
          );
          
          if (!validatedData) {
            throw new Error('Invalid leaderboard data received from server');
          }
          
          setPlayers(validatedData.players);
          setLastUpdated(validatedData.lastUpdated);
          setWebpageTimestamp(validatedData.webpageTimestamp);
          setHasPreviousDayData(validatedData.hasPreviousDayData);
          setPreviousDayDate(validatedData.previousDayDate);
          setIsHistoricalView(validatedData.isHistorical);
        }
      });
      
      // Reset retry count on success
      setRetryCount(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount((prev: number) => prev + 1);
    fetchData(selectedDate || undefined);
  };

  const handleDateChange = (date: string | null) => {
    setSelectedDate(date);
    if (date) {
      fetchData(date);
    } else {
      fetchData();
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    fetchData(selectedDate || undefined);
    if (!selectedDate) {
      fetchAvailableDates();
    }
  };

  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players];

    // Filter
    if (searchTerm) {
      result = result.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const modifier = sortDirection === 'asc' ? 1 : -1;
      
      // Handle undefined values
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1 * modifier;
      if (bVal === undefined) return -1 * modifier;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * modifier;
    });

    return result;
  }, [players, searchTerm, sortKey, sortDirection]);

  const sortConfig: SortConfig = {
    key: sortKey,
    direction: sortDirection
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center border-b border-gray-800 pb-8">
          <div className="mb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-4xl md:text-5xl">🏆</span>
              <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-transparent bg-clip-text animate-pulse pb-2 leading-tight">
                Bettercgwc.xyz
              </h1>
              <span className="text-4xl md:text-5xl">🏆</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              Cash Game World Championship
            </h2>
            <div className="flex items-center justify-center gap-2 text-xl md:text-2xl font-semibold text-gray-300">
              <span className="text-2xl">♠️</span>
              <span>Leaderboard</span>
              <span className="text-2xl">♥️</span>
            </div>
          </div>
          <div className="text-gray-400 text-sm space-y-1 mb-4">
            <p>Created by Shane &quot;KCC Tech Support&quot;</p>
            <p className="text-gray-500">For Kolde&apos;s Calorie Counters Discord</p>
          </div>
          
          {/* Tip Me Section - Toggleable */}
          <div className="mt-4 mb-4">
            {!showTipSection ? (
              <button
                onClick={() => setShowTipSection(true)}
                className="mx-auto px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-700/30 rounded-lg transition-all flex items-center gap-2 text-purple-300/70 hover:text-purple-300 text-xs"
                title="Show tip addresses"
              >
                <span>💝</span>
                <span>Tip</span>
              </button>
            ) : (
              <div className="p-4 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-purple-900/20 border border-purple-700/30 rounded-lg max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-purple-300 text-sm font-semibold flex items-center gap-2">
                    <span>💝</span>
                    <span>Tip Me</span>
                    <span>💝</span>
                  </p>
                  <button
                    onClick={() => setShowTipSection(false)}
                    className="text-gray-500 hover:text-gray-400 transition-colors text-sm"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3 bg-black/30 p-2 rounded">
                    <span className="text-gray-400 font-medium">ETH:</span>
                    <code className="text-purple-300 font-mono text-[10px] sm:text-xs break-all">0x8c06eA5A880f74A2DC3e00C1d509D47B73bbDB09</code>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-black/30 p-2 rounded">
                    <span className="text-gray-400 font-medium">BTC:</span>
                    <code className="text-purple-300 font-mono text-[10px] sm:text-xs break-all">bc1q9e7pdjsw4p7ytxggv0q0tu4n4z2njjz5wxncad</code>
                  </div>
                </div>
              </div>
            )}
          </div>
          {webpageTimestamp && (
            <p className="text-gray-500 text-xs mt-1">
              Leaderboard last updated: {webpageTimestamp}
            </p>
          )}
          {lastUpdated && (
            <p className="text-gray-600 text-xs">
              Data fetched: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
          {isHistoricalView && selectedDate && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <p className="text-yellow-400 text-sm font-medium">
                📅 Historical View: {new Date(selectedDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-yellow-300/70 text-xs mt-1">
                You are viewing a snapshot of the leaderboard as it was on this date
              </p>
            </div>
          )}
          {!isHistoricalView && hasPreviousDayData && previousDayDate && showPreviousDayStats && (
            <p className="text-blue-400 text-xs mt-2">
              📊 Showing changes since {previousDayDate}
            </p>
          )}
        </div>

        <div className="mb-6 space-y-4">
          {/* Historical date selector */}
          <HistoricalDateSelector
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            loading={loading}
            isHistoricalView={isHistoricalView}
          />

          {/* Search and refresh controls */}
          <SearchAndFilters
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            showPreviousDay={showPreviousDayStats}
            onTogglePreviousDay={() => setShowPreviousDayStats(!showPreviousDayStats)}
            loading={loading}
            isHistoricalView={isHistoricalView}
            hasPreviousDayData={hasPreviousDayData}
            previousDayDate={previousDayDate}
            onRefresh={handleRefresh}
          />
        </div>

        {error && (
          <div className="mb-6">
            <ErrorDisplay
              title="Failed to Load Data"
              message={error}
              onRetry={handleRetry}
              retryText={retryCount > 0 ? `Retry (${retryCount})` : 'Retry'}
            />
          </div>
        )}

        {loading && players.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p>Loading data{retryCount > 0 ? ` (Retry ${retryCount})` : ''}...</p>
          </div>
        ) : (
          <LeaderboardTable
            players={filteredAndSortedPlayers}
            sortConfig={sortConfig}
            onSort={handleSort}
            showPreviousDay={showPreviousDayStats}
            searchTerm={searchTerm}
          />
        )}

        <div className="mt-6 text-center text-gray-500 text-sm">
          Showing {filteredAndSortedPlayers.length} of {players.length} players
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-xs">
            All information comes from:{' '}
            <a
              href="https://www.pokerstrategy.com/HSCGWP2025/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
            >
              https://www.pokerstrategy.com/HSCGWP2025/
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
