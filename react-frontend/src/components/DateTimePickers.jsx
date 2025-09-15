import React, { useState } from 'react';
import './DateTimePickers.css';

const DateTimePickers = ({ onDateRangeChange, onDateFilterToggle, archiveType }) => {
  // Format date for datetime-local input (without timezone conversion)
  const formatLocalDateTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Set default start datetime to beginning of month at 07:00
  const getDefaultStartDateTime = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(7, 0, 0, 0);
    return formatLocalDateTime(startOfMonth);
  };

  // Set default end datetime to current date at 06:00
  const getDefaultEndDateTime = () => {
    const today = new Date();
    today.setHours(6, 0, 0, 0);
    return formatLocalDateTime(today);
  };

  const [startDateTime, setStartDateTime] = useState(getDefaultStartDateTime());
  const [endDateTime, setEndDateTime] = useState(getDefaultEndDateTime());
  const [isEnabled, setIsEnabled] = useState(false);

  const parseDateTime = (datetimeStr) => {
    const date = new Date(datetimeStr);
    return {
      date: date.toISOString().split('T')[0],
      hour: date.getHours()
    };
  };

  const notifyChange = (startVal, endVal) => {
    if (onDateRangeChange) {
      const startParsed = parseDateTime(startVal);
      const endParsed = parseDateTime(endVal);

      // For daily archive, use only dates (ignore time completely)
      // For other archives, use full datetime
      if (archiveType === 'daily') {
        // Extract only date part, ignore time
        const startDate = new Date(startVal);
        const endDate = new Date(endVal);

        const formatDateOnly = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        onDateRangeChange({
          fromDate: formatDateOnly(startDate),
          toDate: formatDateOnly(endDate),
          startHour: 0, // Always 0 for daily
          endHour: 23   // Always 23 for daily (full day)
        });
      } else {
        // For non-daily archives, send datetime in local format
        const startDateTime = new Date(startVal);
        startDateTime.setMinutes(0, 0, 0); // Set minutes and seconds to 0

        const endDateTime = new Date(endVal);
        endDateTime.setMinutes(0, 0, 0); // Set minutes and seconds to 0

        // Format as YYYY-MM-DD HH:MM:SS (local time without timezone)
        const formatLocalDateTimeForAPI = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:00:00`;
        };

        onDateRangeChange({
          fromDate: formatLocalDateTimeForAPI(startDateTime),
          toDate: formatLocalDateTimeForAPI(endDateTime),
          startHour: startParsed.hour,
          endHour: endParsed.hour
        });
      }
    }
  };

  const handleStartDateTimeChange = (value) => {
    setStartDateTime(value);
    // Use the new value directly instead of relying on state
    setTimeout(() => notifyChange(value, endDateTime), 0);
  };

  const handleEndDateTimeChange = (value) => {
    setEndDateTime(value);
    // Use the new value directly instead of relying on state
    setTimeout(() => notifyChange(startDateTime, value), 0);
  };

  const handleEnabledChange = (value) => {
    setIsEnabled(value);
    if (onDateFilterToggle) {
      onDateFilterToggle(value);
    }
  };


  return (
    <div className="datetime-pickers">
      <div className="picker-row">
        <label className="picker-label">Начало периода</label>
        <input
          type="datetime-local"
          value={startDateTime}
          onChange={(e) => handleStartDateTimeChange(e.target.value)}
          className="datetime-picker"
          step="3600" // 1 hour steps
        />

        <label className="picker-label">Конец периода</label>
        <input
          type="datetime-local"
          value={endDateTime}
          onChange={(e) => handleEndDateTimeChange(e.target.value)}
          className="datetime-picker"
          step="3600" // 1 hour steps
        />

        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          className="enable-checkbox"
        />
      </div>
    </div>
  );
};

export default DateTimePickers;