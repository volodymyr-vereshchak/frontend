import React, { useState, useEffect, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru, uk } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './DateTimePickers.css';
import { useLanguage } from '../contexts/LanguageContext';

// Register locales
registerLocale('ru', ru);
registerLocale('uk', uk);

const DateTimePickers = ({ onDateRangeChange, onDateFilterToggle, archiveType, initialDateRange }) => {
  const { language, t } = useLanguage();

  // Set default start datetime to beginning of month at 07:00
  const getDefaultStartDateTime = () => {
    if (initialDateRange?.fromDate) {
      const date = new Date(initialDateRange.fromDate);
      date.setHours(initialDateRange.startHour || 7, 0, 0, 0);
      return date;
    }
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(7, 0, 0, 0);
    return startOfMonth;
  };

  // Set default end datetime to current date at 06:00
  const getDefaultEndDateTime = () => {
    if (initialDateRange?.toDate) {
      const date = new Date(initialDateRange.toDate);
      date.setHours(initialDateRange.endHour || 6, 0, 0, 0);
      return date;
    }
    const today = new Date();
    today.setHours(6, 0, 0, 0);
    return today;
  };

  const [startDateTime, setStartDateTime] = useState(getDefaultStartDateTime());
  const [endDateTime, setEndDateTime] = useState(getDefaultEndDateTime());
  const [isEnabled, setIsEnabled] = useState(false);
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);
  const [shouldAutoClose, setShouldAutoClose] = useState(false);

  // Trigger notifyChange when archiveType changes
  useEffect(() => {
    notifyChange(startDateTime, endDateTime);
  }, [archiveType]);

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

        const dailyDateRange = {
          fromDate: formatDateOnly(startDate),
          toDate: formatDateOnly(endDate),
          startHour: 0, // Always 0 for daily
          endHour: 23   // Always 23 for daily (full day)
        };
        onDateRangeChange(dailyDateRange);
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

        const hourlyDateRange = {
          fromDate: formatLocalDateTimeForAPI(startDateTime),
          toDate: formatLocalDateTimeForAPI(endDateTime),
          startHour: startParsed.hour,
          endHour: endParsed.hour
        };
        onDateRangeChange(hourlyDateRange);
      }
    }
  };

  const handleStartDateTimeChange = (date) => {
    setStartDateTime(date);
    // Use the new value directly instead of relying on state
    setTimeout(() => notifyChange(date, endDateTime), 0);
  };

  const handleEndDateTimeChange = (date) => {
    setEndDateTime(date);
    // Use the new value directly instead of relying on state
    setTimeout(() => notifyChange(startDateTime, date), 0);
  };

  // Handle date selection (when user clicks on a date)
  const handleStartDateSelect = (date) => {
    setStartDateTime(date);
    setTimeout(() => notifyChange(date, endDateTime), 0);
    // Close picker after date selection
    setTimeout(() => {
      if (startPickerRef.current) {
        startPickerRef.current.setOpen(false);
      }
    }, 100);
  };

  const handleEndDateSelect = (date) => {
    setEndDateTime(date);
    setTimeout(() => notifyChange(startDateTime, date), 0);
    // Close picker after date selection
    setTimeout(() => {
      if (endPickerRef.current) {
        endPickerRef.current.setOpen(false);
      }
    }, 100);
  };

  // Handle input event (triggered only on actual user input/selection)
  const handleStartInput = (e) => {
    handleStartDateTimeChange(e.target.value);
    // Auto-close on input event (real user selection)
    setTimeout(() => {
      e.target.blur();
    }, 150);
  };

  const handleEndInput = (e) => {
    handleEndDateTimeChange(e.target.value);
    // Auto-close on input event (real user selection)
    setTimeout(() => {
      e.target.blur();
    }, 150);
  };


  const handleEnabledChange = (value) => {
    setIsEnabled(value);
    if (onDateFilterToggle) {
      onDateFilterToggle(value);
    }
  };


  const currentLocale = language === 'uk' ? 'uk' : 'ru';

  return (
    <div className="datetime-pickers">
      <div className="picker-row">
        <label className="picker-label">{t('periodStart')}</label>
        <DatePicker
          ref={startPickerRef}
          selected={startDateTime}
          onChange={handleStartDateTimeChange}
          showTimeSelect
          timeIntervals={60}
          timeFormat="HH:mm"
          dateFormat="dd.MM.yyyy HH:mm"
          className="datetime-picker"
          locale={currentLocale}
          placeholderText={t('selectDateTime')}
          shouldCloseOnSelect={false}
          onSelect={handleStartDateSelect}
        />

        <label className="picker-label">{t('periodEnd')}</label>
        <DatePicker
          ref={endPickerRef}
          selected={endDateTime}
          onChange={handleEndDateTimeChange}
          showTimeSelect
          timeIntervals={60}
          timeFormat="HH:mm"
          dateFormat="dd.MM.yyyy HH:mm"
          className="datetime-picker"
          locale={currentLocale}
          placeholderText={t('selectDateTime')}
          minDate={startDateTime}
          shouldCloseOnSelect={false}
          onSelect={handleEndDateSelect}
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