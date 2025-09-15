import React, { useState, useCallback } from 'react'
import './App.css'
import TopMenu from './components/TopMenu'
import DateTimePickers from './components/DateTimePickers'
import TreeView from './components/TreeView'
import DataTable from './components/DataTable'
import InteractiveChart from './components/InteractiveChart'

function App() {
  const [selectedLines, setSelectedLines] = useState([]);
  // Initialize dateRange with commercial day logic
  const getInitialDateRange = () => {
    const today = new Date();

    // Start of month at 07:00
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];

    // Current date at 06:00
    const endDate = today.toISOString().split('T')[0];

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

  return (
    <div className="App">
      <div className="app-container">
        <TopMenu
          onArchiveTypeChange={handleArchiveTypeChange}
          archiveType={archiveType}
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
    </div>
  )
}

export default App