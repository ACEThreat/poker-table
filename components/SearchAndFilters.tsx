'use client';

/**
 * SearchAndFilters Component
 * Provides search functionality and filter controls for the leaderboard
 */

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showPreviousDay: boolean;
  onTogglePreviousDay: () => void;
  loading: boolean;
  isHistoricalView: boolean;
  hasPreviousDayData: boolean;
  previousDayDate: string | null;
  onRefresh: () => void;
}

/**
 * Search and filter controls component
 */
export default function SearchAndFilters({
  searchQuery,
  onSearchChange,
  showPreviousDay,
  onTogglePreviousDay,
  loading,
  isHistoricalView,
  hasPreviousDayData,
  previousDayDate,
  onRefresh
}: SearchAndFiltersProps) {
  return (
    <div className="flex gap-4 items-center flex-wrap justify-between">
      <div className="flex gap-4 items-center flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      <div className="flex gap-4 items-center">
        {/* Previous day comparison toggle - minimal aesthetic version */}
        {!isHistoricalView && hasPreviousDayData && previousDayDate && (
          <button
            onClick={onTogglePreviousDay}
            className={`group relative px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
              showPreviousDay 
                ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' 
                : 'bg-gray-800/50 text-gray-500 hover:bg-gray-800 hover:text-gray-400'
            }`}
            title={showPreviousDay ? `Hide changes since ${previousDayDate}` : `Show changes since ${previousDayDate}`}
          >
            <span className="text-sm">📊</span>
            <span className="text-xs font-medium">{showPreviousDay ? 'On' : 'Off'}</span>
          </button>
        )}
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
}