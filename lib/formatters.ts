/**
 * Formatting utility functions for the poker leaderboard
 */

/**
 * Formats a number as currency with proper sign placement
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "$1,234.56" or "-$1,234.56")
 */
export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '$' : '-$';
  return sign + Math.abs(value).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Formats a number with thousands separators
 * @param value - The numeric value to format
 * @returns Formatted number string (e.g., "1,234")
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Formats a change value with sign and appropriate formatting
 * Used for displaying differences from previous period
 * @param value - The change value (can be undefined)
 * @param isCurrency - Whether to format as currency
 * @returns Object with formatted string and color class, or null if no change
 */
export function formatChangeData(value: number | undefined, isCurrency: boolean = false): {
  formatted: string;
  color: string;
} | null {
  if (value === undefined || value === 0) return null;
  
  const sign = value > 0 ? '+' : '';
  const formatted = isCurrency 
    ? `${sign}${formatCurrency(value)}` 
    : `${sign}${value.toFixed(2)}`;
  
  const color = value > 0 ? 'text-green-400' : 'text-red-400';
  
  return { formatted, color };
}

/**
 * Gets rank change indicator data
 * @param change - The rank change value (positive means rank improved/went down in number)
 * @returns Object with direction, value, and title, or null if no change
 */
export function getRankChangeData(change: number | undefined): {
  direction: 'up' | 'down';
  value: number;
  title: string;
  color: string;
  symbol: string;
} | null {
  if (change === undefined || change === 0) return null;
  
  if (change > 0) {
    return {
      direction: 'up',
      value: change,
      title: `Up ${change} position${change > 1 ? 's' : ''}`,
      color: 'text-green-400',
      symbol: '↑'
    };
  } else {
    const absChange = Math.abs(change);
    return {
      direction: 'down',
      value: absChange,
      title: `Down ${absChange} position${absChange > 1 ? 's' : ''}`,
      color: 'text-red-400',
      symbol: '↓'
    };
  }
}