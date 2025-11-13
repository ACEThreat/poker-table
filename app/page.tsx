'use client';

import { useState, useEffect, useMemo } from 'react';

type Player = {
  rank: number;
  name: string;
  evWon: number;
  evBB100: number;
  won: number;
  hands: number;
};

type SortKey = keyof Player;
type SortDirection = 'asc' | 'desc';

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [webpageTimestamp, setWebpageTimestamp] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setPlayers(data.players || []);
      setLastUpdated(data.lastUpdated || '');
      setWebpageTimestamp(data.webpageTimestamp || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
        </div>

        <div className="mb-6 flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
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
                      <span className={`font-medium ${
                        player.rank === 1 ? 'text-yellow-400' : 
                        player.rank === 2 ? 'text-gray-300' : 
                        player.rank === 3 ? 'text-orange-400' : 
                        'text-gray-400'
                      }`}>
                        {player.rank}
                      </span>
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
                      {formatCurrency(player.evWon)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      player.evBB100 >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {player.evBB100.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      player.won >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(player.won)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">
                      {formatNumber(player.hands)}
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
