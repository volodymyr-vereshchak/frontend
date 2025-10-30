import React, { useState, useCallback, useEffect } from 'react'
import './App.css'
import TopMenu from './components/TopMenu'
import DateTimePickers from './components/DateTimePickers'
import TreeView from './components/TreeView'
import DataTable from './components/DataTable'
import InteractiveChart from './components/InteractiveChart'
import GRSReport from './components/GRSReport'
import { LanguageProvider } from './contexts/LanguageContext'

function App() {
  // Initialize dateRange with commercial day logic
  const getInitialDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // First day of current month
    const startDate = `${year}-${month}-01`;

    // Current date
    const endDate = `${year}-${month}-${day}`;

    return {
      fromDate: startDate,
      toDate: endDate,
      startHour: 7,
      endHour: 6
    };
  };

  // Parse URL parameters on initial load
  const getInitialStateFromURL = () => {
    const params = new URLSearchParams(window.location.search);

    const archiveTypeParam = params.get('archiveType');
    const fromDateParam = params.get('fromDate');
    const toDateParam = params.get('toDate');
    const lineIdParam = params.get('lineId');
    const dateFilterEnabledParam = params.get('dateFilterEnabled');

    const initialState = {
      archiveType: archiveTypeParam || 'daily',
      dateRange: getInitialDateRange(),
      selectedLines: [],
      isDateFilterEnabled: false,
      lineIdFromURL: null
    };

    // Set date range if provided in URL
    if (fromDateParam && toDateParam) {
      initialState.dateRange = {
        fromDate: fromDateParam,
        toDate: toDateParam,
        startHour: 7,
        endHour: 6
      };
    }

    // Set date filter enabled state
    if (dateFilterEnabledParam === 'true') {
      initialState.isDateFilterEnabled = true;
    }

    // Store lineId to be selected after TreeView loads
    if (lineIdParam) {
      initialState.lineIdFromURL = parseInt(lineIdParam, 10);
    }

    return initialState;
  };

  const initialState = getInitialStateFromURL();

  const [selectedLines, setSelectedLines] = useState(initialState.selectedLines);
  const [dateRange, setDateRange] = useState(initialState.dateRange);
  const [isDateFilterEnabled, setIsDateFilterEnabled] = useState(initialState.isDateFilterEnabled);
  const [archiveType, setArchiveType] = useState(initialState.archiveType);
  const [chartData, setChartData] = useState([]);
  const [isGRSReportOpen, setIsGRSReportOpen] = useState(false);
  const [lineIdFromURL, setLineIdFromURL] = useState(initialState.lineIdFromURL);

  const handleLinesSelected = useCallback((lineIds) => {
    setSelectedLines(lineIds);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(prev => {
      // Only update if actually changed
      if (JSON.stringify(prev) === JSON.stringify(newDateRange)) {
        return prev;
      }
      return newDateRange;
    });
  }, []);

  const handleDateFilterToggle = useCallback((enabled) => {
    setIsDateFilterEnabled(enabled);
  }, []);

  const handleArchiveTypeChange = useCallback((type) => {
    setArchiveType(type);
  }, []);

  const handleDataChange = useCallback((data) => {
    setChartData(data || []);
  }, []);

  const handleGRSReportOpen = useCallback(() => {
    setIsGRSReportOpen(true);
  }, []);

  const handleGRSReportClose = useCallback(() => {
    setIsGRSReportOpen(false);
  }, []);

  return (
    <LanguageProvider>
      <div className="App">
      <div className="app-container">
        <TopMenu
          onArchiveTypeChange={handleArchiveTypeChange}
          archiveType={archiveType}
          onGRSReportClick={handleGRSReportOpen}
        />
        <hr className="separator" />
        <DateTimePickers
          onDateRangeChange={handleDateRangeChange}
          onDateFilterToggle={handleDateFilterToggle}
          archiveType={archiveType}
          initialDateRange={dateRange}
          initialEnabled={isDateFilterEnabled}
        />
        <hr className="separator" />

        <div className="main-layout">
          <div className="sidebar">
            <TreeView onLinesSelected={handleLinesSelected} initialLineId={lineIdFromURL} />
          </div>

          <div className="content-area">
            <DataTable
              selectedLines={selectedLines}
              dateRange={dateRange}
              isDateFilterEnabled={isDateFilterEnabled}
              archiveType={archiveType}
              onDataChange={handleDataChange}
            />
          </div>
        </div>

        {/* Chart section - only for daily and hourly archives */}
        {(archiveType === 'daily' || archiveType === 'hourly') && (
          <InteractiveChart
            data={chartData}
            archiveType={archiveType}
            selectedLines={selectedLines}
          />
        )}
      </div>

      {/* GRS Report Modal */}
      <GRSReport
        isOpen={isGRSReportOpen}
        onClose={handleGRSReportClose}
      />
      </div>
    </LanguageProvider>
  )
}

export default App