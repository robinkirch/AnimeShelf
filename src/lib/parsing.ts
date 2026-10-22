/**
 * Converts a MyAnimeList duration ("24 min per ep", "1 hr 55 min", "2 hr") to minutes.
 * Returns null if the string contains no hours or minutes (e.g. "Unknown", "30 sec").
 */
export function parseDurationToMinutes(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  const hours = durationStr.match(/(\d+)\s*hr/i);
  const minutes = durationStr.match(/(\d+)\s*min/i);
  if (!hours && !minutes) return null;
  const total = (hours ? parseInt(hours[1], 10) * 60 : 0) + (minutes ? parseInt(minutes[1], 10) : 0);
  return total > 0 ? total : null;
}

/**
 * Parses a single line of CSV text into an array of strings.
 * Handles quoted fields containing delimiters and escaped quotes ("").
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Check for an escaped quote ("")
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        currentField += '"';
        i++; // Skip the second quote of the pair
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  values.push(currentField);
  return values;
}
