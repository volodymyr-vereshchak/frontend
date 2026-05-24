/**
 * Utility functions for converting values between different formats
 * Replicates Python logic from data_proc.py: convert_int_to_hex_to_float
 */

/**
 * Convert integer to float using hex representation
 * Equivalent to Python: struct.unpack("!f", struct.pack("!i", value))[0]
 *
 * @param {number} intValue - Integer value to convert
 * @returns {number} - Float value
 */
export function convertIntToHexToFloat(intValue) {
  if (intValue === null || intValue === undefined) {
    return 0;
  }

  // Convert integer to 32-bit signed integer (equivalent to struct.pack("!i", value))
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  // Write as big-endian signed 32-bit integer
  view.setInt32(0, intValue, false); // false = big-endian

  // Read as big-endian 32-bit float (equivalent to struct.unpack("!f", ...))
  const floatValue = view.getFloat32(0, false); // false = big-endian

  return floatValue;
}

/**
 * Convert array of integers to floats using hex representation
 *
 * @param {number[]} intArray - Array of integers to convert
 * @returns {number[]} - Array of float values
 */
export function convertIntArrayToFloatArray(intArray) {
  if (!Array.isArray(intArray)) {
    return [];
  }

  return intArray.map(convertIntToHexToFloat);
}

/**
 * Format a raw int from the edit archive into a human-readable string.
 *
 * Cases (in order):
 *  - |v| <= 32767 → enum/flag, display as integer (e.g. sensor type 0, 1, 2)
 *  - editName contains "час"/"время" → float is seconds → display as HH:MM:SS
 *  - |float| < 0.001 → coefficient, scientific notation (e.g. "1.6214e-5")
 *  - |float| >= 100000 → 2 decimal places
 *  - otherwise → 4 decimal places
 *
 * @param {number} rawInt   - Original integer value from DB
 * @param {string} editName - Name of the edit type (used for time detection)
 * @returns {string}
 */
export function formatEditValue(rawInt, editName = '') {
  if (rawInt === null || rawInt === undefined) return '—';

  if (rawInt >= -32767 && rawInt <= 32767) return String(rawInt);

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, rawInt, false);
  const f = view.getFloat32(0, false);

  if (!isFinite(f) || isNaN(f)) return String(rawInt);

  // Time field: name contains "час" or "время" → seconds since midnight → HH:MM:SS
  if (/час|время/i.test(editName)) {
    const totalSec = Math.round(Math.abs(f));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const abs = Math.abs(f);
  if (abs === 0) return '0';
  if (abs < 0.001) return f.toExponential(4);
  if (abs >= 100000) return f.toFixed(2);
  return f.toFixed(4);
}