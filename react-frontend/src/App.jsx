import React, { useState, useCallback } from 'react'
import './App.css'
import TopMenu from './components/TopMenu'
import DateTimePickers from './components/DateTimePickers'
import TreeView from './components/TreeView'
import DataTable from './components/DataTable'
import InteractiveChart from './components/InteractiveChart'

function App() {
  const [selectedLines, setSelectedLines] = useState([]);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    startHour: 7,
    endHour: 7
  });
  const [isDateFilterEnabled, setIsDateFilterEnabled] = useState(false);
  const [archiveType, setArchiveType] = useState('daily');
  const [chartData, setChartData] = useState([]);

  const handleLinesSelected = useCallback((lineIds) => {
    console.log('Lines selected in App:', lineIds);
    setSelectedLines(lineIds);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange) => {
    console.log('Date range changed in App:', newDateRange);
    setDateRange(prev => {
      // Only update if actually changed
      if (JSON.stringify(prev) === JSON.stringify(newDateRange)) {
        return prev;
      }
      return newDateRange;
    });
  }, []);

  const handleDateFilterToggle = useCallback((enabled) => {
    console.log('Date filter enabled:', enabled);
    setIsDateFilterEnabled(enabled);
  }, []);

  const handleArchiveTypeChange = useCallback((type) => {
    console.log('Archive type changed:', type);
    setArchiveType(type);
  }, []);

  const handleDataChange = useCallback((data) => {
    console.log('Chart data updated:', data?.length, 'records');
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