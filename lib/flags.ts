/**
 * Converts a country code (ISO 3166-1 alpha-2) to a flag emoji
 * @param countryCode - Two-letter country code (e.g., "US", "GB", "CA"), or null for unknown
 * @returns Flag emoji, "❓" for unknown/null, or empty string if invalid
 */
export function countryCodeToFlag(countryCode: string | null | undefined): string {
  // Return "❓" for explicitly null (unknown) country codes
  if (countryCode === null) {
    return '❓';
  }
  
  // Return empty string for undefined or invalid codes
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const code = countryCode.toUpperCase();
  
  // Convert country code to flag emoji using regional indicator symbols
  // A = U+1F1E6, B = U+1F1E7, etc.
  const codePoints = [...code].map(char => 
    0x1F1E6 - 65 + char.charCodeAt(0)
  );
  
  return String.fromCodePoint(...codePoints);
}

/**
 * Gets a list of common country codes and their names for reference
 */
export const COMMON_COUNTRIES = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'IN': 'India',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'PL': 'Poland',
  'PT': 'Portugal',
  'IE': 'Ireland',
  'NZ': 'New Zealand',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'RU': 'Russia',
  'AR': 'Argentina',
} as const;
