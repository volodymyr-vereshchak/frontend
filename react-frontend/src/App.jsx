import React, { useState, useCallback } from 'react'
import './App.css'
import TopMenu from './components/TopMenu'
import DateTimePickers from './components/DateTimePickers'
import TreeView from './components/TreeView'
import DataTable from './components/DataTable'
import InteractiveChart from './components/InteractiveChart'
import GRSReport from './components/GRSReport'
import { LanguageProvider } from './contexts/LanguageContext'

function App() {
  const [selectedLines, setSelectedLines] = useState([]);
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

  const [dateRange, setDateRange] = useState(getInitialDateRange());
  const [isDateFilterEnabled, setIsDateFilterEnabled] = useState(false);
  const [archiveType, setArchiveType] = useState('daily');
  const [chartData, setChartData] = useState([]);
  const [isGRSReportOpen, setIsGRSReportOpen] = useState(false);

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
        />
        <hr className="separator" />

        <div className="main-layout">
          <div className="sidebar">
            <TreeView onLinesSelected={handleLinesSelected} />
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