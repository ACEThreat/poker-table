'use client';

/**
 * LeaderboardTable Component
 * Displays the main poker leaderboard table with sortable columns
 */

import { Player, SortKey, SortConfig } from '@/lib/types';
import { formatCurrency, formatNumber, formatChangeData, getRankChangeData } from '@/lib/formatters';
import { countryCodeToFlag } from '@/lib/flags';

interface LeaderboardTableProps {
  players: Player[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  showPreviousDay: boolean;
  searchTerm?: string;
}

/**
 * Sort icon component showing current sort direction
 */
function SortIcon({ columnKey, sortConfig }: { columnKey: SortKey; sortConfig: SortConfig }) {
  if (sortConfig.key !== columnKey) {
    return <span className="text-gray-600">⇅</span>;
  }
  return sortConfig.direction === 'asc' 
    ? <span className="text-blue-400">↑</span> 
    : <span className="text-blue-400">↓</span>;
}

/**
 * Rank change indicator component
 */
function RankChangeIndicator({ change }: { change: number | undefined }) {
  const rankData = getRankChangeData(change);
  if (!rankData) return null;
  
  return (
    <span 
      className={`${rankData.color} text-xs ml-1`}
      title={rankData.title}
    >
      {rankData.symbol}{rankData.value}
    </span>
  );
}

/**
 * Format and display a change value
 */
function ChangeDisplay({ value, isCurrency = false }: { value: number | undefined; isCurrency?: boolean }) {
  const changeData = formatChangeData(value, isCurrency);
  if (!changeData) return null;
  
  return (
    <span className={`text-xs ml-1 ${changeData.color}`}>
      ({changeData.formatted})
    </span>
  );
}

/**
 * Main leaderboard table component
 */
export default function LeaderboardTable({
  players,
  sortConfig,
  onSort,
  showPreviousDay,
  searchTerm = ''
}: LeaderboardTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th
                onClick={() => onSort('rank')}
                className="px-4 py-3 text-left cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Rank <SortIcon columnKey="rank" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                onClick={() => onSort('name')}
                className="px-4 py-3 text-left cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Player <SortIcon columnKey="name" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                onClick={() => onSort('evWon')}
                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  $ EV Won <SortIcon columnKey="evWon" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                onClick={() => onSort('evBB100')}
                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  EV BB/100 <SortIcon columnKey="evBB100" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                onClick={() => onSort('won')}
                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  $ Won <SortIcon columnKey="won" sortConfig={sortConfig} />
                </div>
              </th>
              <th
                onClick={() => onSort('hands')}
                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  Hands <SortIcon columnKey="hands" sortConfig={sortConfig} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
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
                    {showPreviousDay && <RankChangeIndicator change={player.rankChange} />}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {player.countryCode && (
                    <span className="mr-2" title={player.countryCode}>
                      {countryCodeToFlag(player.countryCode)}
                    </span>
                  )}
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
                    {showPreviousDay && <ChangeDisplay value={player.evWonChange} isCurrency />}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  player.evBB100 >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  <div className="flex items-center justify-end">
                    {player.evBB100.toFixed(2)}
                    {showPreviousDay && <ChangeDisplay value={player.evBB100Change} />}
                  </div>
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  player.won >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  <div className="flex items-center justify-end">
                    {formatCurrency(player.won)}
                    {showPreviousDay && <ChangeDisplay value={player.wonChange} isCurrency />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-400">
                  <div className="flex items-center justify-end">
                    {formatNumber(player.hands)}
                    {showPreviousDay && player.handsChange !== undefined && player.handsChange !== 0 && (
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
        {players.length === 0 && searchTerm && (
          <div className="text-center py-8 text-gray-400">
            No players found matching &quot;{searchTerm}&quot;
          </div>
        )}
      </div>
    </>
  );
}