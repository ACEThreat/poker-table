'use client';

/**
 * HistoricalDateSelector Component
 * Provides a dropdown to select and view historical snapshots of the leaderboard
 */

import { HistoricalSnapshot } from '@/lib/types';

interface HistoricalDateSelectorProps {
  availableDates: HistoricalSnapshot[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  loading: boolean;
  isHistoricalView: boolean;
}

/**
 * Historical date selector component
 */
export default function HistoricalDateSelector({
  availableDates,
  selectedDate,
  onDateChange,
  loading,
  isHistoricalView
}: HistoricalDateSelectorProps) {
  if (availableDates.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-4 items-center flex-wrap p-4 bg-gray-900 rounded-lg border border-gray-800">
      <label className="text-gray-400 text-sm font-medium">View historical data:</label>
      <select
        value={selectedDate || ''}
        onChange={(e) => onDateChange(e.target.value || null)}
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
  );
}