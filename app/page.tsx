'use client';

import { useState, useEffect, useMemo } from 'react';

type Player = {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
  // Comparison fields (differences from previous day)
  rankChange?: number;
  evWonChange?: number;
  evBB100Change?: number;
  wonChange?: number;
  handsChange?: number;
};

type SortKey = keyof Player;
type SortDirection = 'asc' | 'desc';

type HistoricalSnapshot = {
  date: string;
  webpageTimestamp: string;
  capturedAt: string;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [webpageTimestamp, setWebpageTimestamp] = useState<string>('');
  const [hasPreviousDayData, setHasPreviousDayData] = useState(false);
  const [previousDayDate, setPreviousDayDate] = useState<string | null>(null);
  
  // Historical data state
  const [availableDates, setAvailableDates] = useState<HistoricalSnapshot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAvailableDates();
  }, []);

  const fetchAvailableDates = async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setAvailableDates(data.snapshots || []);
      }
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
    }
  };

  const fetchData = async (date?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = date ? `/api/history/${date}` : '/api/leaderboard';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      setPlayers(data.players || []);
      setLastUpdated(data.lastUpdated || data.capturedAt || '');
      setWebpageTimestamp(data.webpageTimestamp || '');
      setHasPreviousDayData(data.hasPreviousDayData || false);
      setPreviousDayDate(data.previousDayDate || null);
      setIsHistoricalView(data.isHistorical || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
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

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? '$' : '-$';
    return sign + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('en-US');
  };

  const formatChange = (value: number | undefined, isCurrency: boolean = false) => {
    if (value === undefined || value === 0) return null;
    
    const sign = value > 0 ? '+' : '';
    const formatted = isCurrency 
      ? `${sign}${formatCurrency(value)}` 
      : `${sign}${value.toFixed(2)}`;
    
    const color = value > 0 ? 'text-green-400' : 'text-red-400';
    
    return (
      <span className={`text-xs ml-1 ${color}`}>
        ({formatted})
      </span>
    );
  };

  const RankChangeIndicator = ({ change }: { change: number | undefined }) => {
    if (change === undefined || change === 0) return null;
    
    if (change > 0) {
      return <span className="text-green-400 text-xs ml-1" title={`Up ${change} position${change > 1 ? 's' : ''}`}>↑{change}</span>;
    } else {
      return <span className="text-red-400 text-xs ml-1" title={`Down ${Math.abs(change)} position${Math.abs(change) > 1 ? 's' : ''}`}>↓{Math.abs(change)}</span>;
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <span className="text-gray-600">⇅</span>;
    return sortDirection === 'asc' ? <span className="text-blue-400">↑</span> : <span className="text-blue-400">↓</span>;
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center border-b border-gray-800 pb-8">
          <div className="mb-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-transparent bg-clip-text">
              Better Cash Game World Championship
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-300 mb-4">
              Results
            </h2>
          </div>
          <div className="text-gray-400 text-sm space-y-1 mb-4">
            <p>Created by Shane &quot;KCC Tech Support&quot;</p>
            <p className="text-gray-500">For Kolde&apos;s Calorie Counters Discord</p>
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
          {!isHistoricalView && hasPreviousDayData && previousDayDate && (
            <p className="text-blue-400 text-xs mt-2">
              📊 Showing changes since {previousDayDate}
            </p>
          )}
        </div>

        <div className="mb-6 space-y-4">
          {/* Historical date selector */}
          {availableDates.length > 0 && (
            <div className="flex gap-4 items-center flex-wrap p-4 bg-gray-900 rounded-lg border border-gray-800">
              <label className="text-gray-400 text-sm font-medium">View historical data:</label>
              <select
                value={selectedDate || ''}
                onChange={(e) => handleDateChange(e.target.value || null)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
                disabled={loading}
              >
                <option value="">Current (Live Data)</option>
                {availableDates.map((snapshot) => (
                  <option key={snapshot.date} value={snapshot.date}>
                    {new Date(snapshot.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </option>
                ))}
              </select>
              {isHistoricalView && (
                <span className="text-yellow-400 text-sm flex items-center gap-2">
                  <span>📅</span>
                  <span>Viewing historical snapshot</span>
                </span>
              )}
            </div>
          )}

          {/* Search and refresh controls */}
          <div className="flex gap-4 items-center flex-wrap">
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={() => {
                fetchData(selectedDate || undefined);
                if (!selectedDate) {
                  fetchAvailableDates();
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            Error: {error}
          </div>
        )}

        {loading && players.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Loading data...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th
                    onClick={() => handleSort('rank')}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Rank <SortIcon columnKey="rank" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Player <SortIcon columnKey="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('evWon')}
                    className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">
                      $ EV Won <SortIcon columnKey="evWon" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('evBB100')}
                    className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">
                      EV BB/100 <SortIcon columnKey="evBB100" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('won')}
                    className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">
                      $ Won <SortIcon columnKey="won" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('hands')}
                    className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Hands <SortIcon columnKey="hands" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedPlayers.map((player) => (
                  <tr
                    key={player.name}
                    className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span className={`font-medium ${
                          player.rank === 1 ? 'text-yellow-400' : 
                          player.rank === 2 ? 'text-gray-300' : 
                          player.rank === 3 ? 'text-orange-400' : 
                          'text-gray-400'
                        }`}>
                          {player.rank}
                        </span>
                        <RankChangeIndicator change={player.rankChange} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {player.name === 'SeaLlama' ? (
                        <span className="text-yellow-500 font-bold">🐐 {player.name} 🐐</span>
                      ) : (
                        player.name
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      player.evWon >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <div className="flex items-center justify-end">
                        {formatCurrency(player.evWon)}
                        {formatChange(player.evWonChange, true)}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      player.evBB100 >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <div className="flex items-center justify-end">
                        {player.evBB100.toFixed(2)}
                        {formatChange(player.evBB100Change)}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      player.won >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <div className="flex items-center justify-end">
                        {formatCurrency(player.won)}
                        {formatChange(player.wonChange, true)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">
                      <div className="flex items-center justify-end">
                        {formatNumber(player.hands)}
                        {player.handsChange !== undefined && player.handsChange !== 0 && (
                          <span className="text-xs ml-1 text-blue-400">
                            (+{formatNumber(player.handsChange)})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAndSortedPlayers.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No players found matching &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center text-gray-500 text-sm">
          Showing {filteredAndSortedPlayers.length} of {players.length} players
        </div>
      </div>
    </div>
  );
}
