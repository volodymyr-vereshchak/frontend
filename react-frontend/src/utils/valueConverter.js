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
 * Process edit archive data by converting old_value and new_value from int to float
 * Replicates Python logic from update_table_edit function
 *
 * @param {Object[]} editData - Array of edit archive records
 * @returns {Object[]} - Processed data with converted values (4 decimal places)
 */
export function processEditArchiveData(editData) {
  if (!Array.isArray(editData)) {
    return [];
  }

  return editData.map(record => ({
    ...record,
    old_value: Number(convertIntToHexToFloat(record.old_value).toFixed(4)),
    new_value: Number(convertIntToHexToFloat(record.new_value).toFixed(4))
  }));
}