/**
 * Robust Client-Side Telemetry Parser for NASA C-MAPSS Sensor Data.
 * 
 * Supports:
 * 1. Standard comma-delimited (.csv) with headers.
 * 2. Space-separated raw NASA C-MAPSS (.txt) 26-column files without headers.
 * 3. Tab-separated (.tsv) data.
 * 4. Multi-engine payloads, grouping by unit_number and sorting by operational cycle.
 * 5. Strict numeric and structure validation without silent fallbacks.
 */

export const RAW_C_MAPSS_COLUMNS = [
  'unit_number',
  'time_cycles',
  'setting_1',
  'setting_2',
  'setting_3',
  'sensor_1',
  'sensor_2',
  'sensor_3',
  'sensor_4',
  'sensor_5',
  'sensor_6',
  'sensor_7',
  'sensor_8',
  'sensor_9',
  'sensor_10',
  'sensor_11',
  'sensor_12',
  'sensor_13',
  'sensor_14',
  'sensor_15',
  'sensor_16',
  'sensor_17',
  'sensor_18',
  'sensor_19',
  'sensor_20',
  'sensor_21',
];

/**
 * Reads text content from a File, Blob, or string.
 */
export async function readTextContent(fileOrText) {
  if (typeof fileOrText === 'string') {
    return fileOrText;
  }
  if (fileOrText && typeof fileOrText.text === 'function') {
    return await fileOrText.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file contents'));
    reader.readAsText(fileOrText);
  });
}

/**
 * Detects delimiter: comma, tab, or whitespace regex.
 */
function detectDelimiter(firstLine) {
  if (firstLine.includes(',')) return ',';
  if (firstLine.includes('\t')) return '\t';
  return /\s+/;
}

/**
 * Checks if a split array of tokens is a header row.
 */
function isHeaderRow(tokens) {
  if (!tokens || tokens.length === 0) return false;
  // If the first token parses as a valid finite number, it is numeric data (no header)
  const firstVal = Number(tokens[0]);
  if (!Number.isNaN(firstVal) && tokens[0].trim() !== '') {
    return false;
  }
  // Otherwise check if any token contains typical header keywords
  const text = tokens.join(' ').toLowerCase();
  return (
    text.includes('unit') ||
    text.includes('cycle') ||
    text.includes('sensor') ||
    text.includes('setting')
  );
}

/**
 * Parses and validates telemetry data for sensor visualization.
 */
export async function parseTelemetry(fileOrText) {
  const result = {
    success: false,
    rowCount: 0,
    enginesData: {},
    engineIds: [],
    warnings: [],
    error: null,
  };

  let rawText = '';
  try {
    rawText = await readTextContent(fileOrText);
  } catch (err) {
    result.error = `Unable to read file: ${err.message}`;
    return result;
  }

  const cleanText = (rawText || '').trim();
  if (!cleanText) {
    result.error = 'The uploaded file is empty.';
    return result;
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    result.error = 'The uploaded file contains no data lines.';
    return result;
  }

  const firstLine = lines[0];
  const delimiter = detectDelimiter(firstLine);

  let initialTokens;
  if (delimiter instanceof RegExp) {
    initialTokens = firstLine.split(delimiter);
  } else {
    initialTokens = firstLine.split(delimiter).map((t) => t.trim());
  }

  const hasHeader = isHeaderRow(initialTokens);
  let columnNames = [];
  let startIndex = 0;

  if (hasHeader) {
    columnNames = initialTokens.map((t) =>
      t.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '')
    );
    startIndex = 1;

    // Check if essential columns are present
    const hasUnit = columnNames.some((c) => c.includes('unit') || c.includes('engine'));
    const hasCycle = columnNames.some((c) => c.includes('cycle') || c.includes('time'));
    if (!hasUnit && !hasCycle) {
      result.warnings.push(
        "Header does not explicitly contain 'unit_number' or 'time_cycles'. Columns will be mapped by standard order if compatible."
      );
    }
  } else {
    // 26-column raw NASA C-MAPSS format without headers
    startIndex = 0;
    if (initialTokens.length === 26) {
      columnNames = [...RAW_C_MAPSS_COLUMNS];
    } else {
      // Create fallback numbered columns
      columnNames = initialTokens.map((_, idx) => {
        if (idx === 0) return 'unit_number';
        if (idx === 1) return 'time_cycles';
        if (idx >= 2 && idx <= 4) return `setting_${idx - 1}`;
        return `sensor_${idx - 4}`;
      });
      result.warnings.push(
        `File has ${initialTokens.length} columns without headers (expected 26 for NASA C-MAPSS). Parsing with generic mapping.`
      );
    }
  }

  const parsedRecords = [];
  let malformedRowCount = 0;

  for (let lineIdx = startIndex; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let tokens;
    if (delimiter instanceof RegExp) {
      tokens = line.split(delimiter);
    } else {
      tokens = line.split(delimiter).map((t) => t.trim());
    }

    if (tokens.length !== columnNames.length) {
      malformedRowCount++;
      continue;
    }

    const rowObj = {};
    let isRowValid = true;

    for (let c = 0; c < columnNames.length; c++) {
      const colName = columnNames[c];
      const rawVal = tokens[c];
      const numVal = Number(rawVal);

      if (rawVal === '' || Number.isNaN(numVal) || !Number.isFinite(numVal)) {
        isRowValid = false;
        break;
      }

      rowObj[colName] = numVal;
    }

    if (!isRowValid) {
      malformedRowCount++;
      continue;
    }

    // Determine unit_number and cycle strictly
    const unitKey =
      columnNames.find((c) => c.includes('unit') || c.includes('engine')) ||
      columnNames[0];
    const cycleKey =
      columnNames.find((c) => c.includes('cycle') || c.includes('time')) ||
      columnNames[1];

    const unit = Number(rowObj[unitKey]);
    const cycle = Number(rowObj[cycleKey]);

    if (!Number.isInteger(unit) || unit <= 0 || !Number.isInteger(cycle) || cycle <= 0) {
      malformedRowCount++;
      continue;
    }

    // Clean record for chart visualization
    const cleanChartRecord = {
      unit_number: unit,
      cycle: cycle,
    };

    // Attach all sensor channels
    Object.keys(rowObj).forEach((key) => {
      if (key.startsWith('sensor_') || key.startsWith('s_') || key.startsWith('setting_')) {
        cleanChartRecord[key] = rowObj[key];
      }
    });

    parsedRecords.push(cleanChartRecord);
  }

  if (malformedRowCount > 0) {
    result.warnings.push(
      `Encountered and skipped ${malformedRowCount} invalid or malformed row(s) with non-numeric or missing values.`
    );
  }

  if (parsedRecords.length === 0) {
    result.error =
      'No valid numeric telemetry rows could be parsed. Verify the file format.';
    return result;
  }

  // Group by engine unit_number
  const grouped = {};
  parsedRecords.forEach((record) => {
    const unit = record.unit_number;
    if (!grouped[unit]) grouped[unit] = [];
    grouped[unit].push(record);
  });

  // Sort each engine's observations strictly ascending by cycle
  const engineIds = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  engineIds.forEach((unit) => {
    grouped[unit].sort((a, b) => a.cycle - b.cycle);

    // Check for duplicate cycles
    const seenCycles = new Set();
    let dupCount = 0;
    grouped[unit].forEach((r) => {
      if (seenCycles.has(r.cycle)) dupCount++;
      seenCycles.add(r.cycle);
    });
    if (dupCount > 0) {
      result.warnings.push(
        `Engine #${unit} contains ${dupCount} duplicate cycle observation(s).`
      );
    }
  });

  result.success = true;
  result.rowCount = parsedRecords.length;
  result.enginesData = grouped;
  result.engineIds = engineIds;

  return result;
}
