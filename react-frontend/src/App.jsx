import React, { useState, useCallback, useEffect } from 'react'
import './App.css'
import TopMenu from './components/TopMenu'
import DateTimePickers from './components/DateTimePickers'
import TreeView from './components/TreeView'
import DataTable from './components/DataTable'
import InteractiveChart from './components/InteractiveChart'
import OverviewTab from './components/OverviewTab'
import EnterprisePollAnalysis from './components/EnterprisePollAnalysis'
import AdminPanel from './components/AdminPanel/AdminPanel'
import AccidentsPage from './components/AccidentsPage'
import GRSTrendsPage from './components/GRSTrendsPage'
import NightConsumptionPage from './components/NightConsumptionPage'
import LoginPage from './components/LoginPage/LoginPage'
import { LanguageProvider } from './contexts/LanguageContext'
import { UserProvider } from './contexts/UserContext'
import { useUser } from './contexts/UserContext'
import { virtualLinesHelper } from './services/api'
import { clearEnterpriseCache, cleanExpired, enforceCacheBudget } from './services/enterpriseCache'

function safeSetItem(key, value) {
  const s = JSON.stringify(value);
  try { localStorage.setItem(key, s); }
  catch {
    enforceCacheBudget(1 * 1024 * 1024);
    try { localStorage.setItem(key, s); } catch {}
  }
}

function AppInner() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                    height:'100vh', color:'#888', fontSize:16 }}>
        Завантаження...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AppContent user={user} />;
}

function App() {
  return (
    <UserProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </UserProvider>
  );
}

function AppContent({ user }) {
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

    let savedTab = 'overview';
    let savedLineId = null;
    try {
      const s = localStorage.getItem('hlv-active-tab');
      if (s) savedTab = JSON.parse(s);
      const sl = localStorage.getItem('hlv-selected-line');
      if (sl !== null) savedLineId = JSON.parse(sl);
    } catch {}

    // Clear any stale date state that may have been saved previously
    localStorage.removeItem('hlv-date-range');
    localStorage.removeItem('hlv-date-filter');

    const initialState = {
      archiveType: archiveTypeParam || savedTab,
      dateRange: getInitialDateRange(),
      selectedLines: [],
      isDateFilterEnabled: false,
      lineIdFromURL: null
    };

    // URL params override localStorage
    if (fromDateParam && toDateParam) {
      initialState.dateRange = {
        fromDate: fromDateParam,
        toDate: toDateParam,
        startHour: 7,
        endHour: 6
      };
    }

    if (dateFilterEnabledParam === 'true') {
      initialState.isDateFilterEnabled = true;
    }

    // URL lineId takes priority over saved line; otherwise restore saved line
    if (lineIdParam) {
      initialState.lineIdFromURL = parseInt(lineIdParam, 10);
    } else if (savedLineId) {
      initialState.lineIdFromURL = savedLineId;
    }

    return initialState;
  };

  const initialState = getInitialStateFromURL();

  const [selectedLines, setSelectedLines] = useState(initialState.selectedLines);
  const [dateRange, setDateRange] = useState(initialState.dateRange);
  const [isDateFilterEnabled, setIsDateFilterEnabled] = useState(initialState.isDateFilterEnabled);
  const [archiveType, setArchiveType] = useState(initialState.archiveType);
  const [chartData, setChartData] = useState([]);
const [lineIdFromURL, setLineIdFromURL] = useState(initialState.lineIdFromURL);
  const [selectedLineIsVirtual, setSelectedLineIsVirtual] = useState(false);

  // Clean expired enterprise cache entries on app startup
  useEffect(() => { cleanExpired(); }, []);

  // Ctrl+Shift+E — clear enterprise cache and re-fetch in all open components
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        clearEnterpriseCache();
        console.log('[EnterpriseCache] Cache cleared via Ctrl+Shift+E');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption') {
      safeSetItem('hlv-active-tab', archiveType);
    }
  }, [archiveType]);

  useEffect(() => {
    safeSetItem('hlv-selected-line', selectedLines[0] ?? null);
  }, [selectedLines]);

  // Auto-switch to daily archive when virtual line is selected with non-allowed archive type
  useEffect(() => {
    if (selectedLineIsVirtual) {
      // Виртуальные линии поддерживают только daily, hourly, overview, poll, admin
      if (archiveType !== 'daily' && archiveType !== 'hourly' && archiveType !== 'overview' &&
          archiveType !== 'poll' && archiveType !== 'admin' && archiveType !== 'accidents' &&
          archiveType !== 'grs-trends' && archiveType !== 'night-consumption') {
        setArchiveType('daily');
      }
    }
  }, [selectedLineIsVirtual, archiveType]);

  const handleLinesSelected = useCallback((lineIds, lineMetadata) => {
    setSelectedLines(lineIds);
    if (lineIds.length > 0) setLineIdFromURL(lineIds[0]);

    // Определить, является ли выбранная линия виртуальной
    if (lineIds && lineIds.length > 0) {
      const firstLineId = lineIds[0];
      const isVirtual = lineMetadata?.is_virtual || virtualLinesHelper.isVirtualLine(firstLineId);
      setSelectedLineIsVirtual(isVirtual);
    } else {
      setSelectedLineIsVirtual(false);
    }
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
isVirtualLine={selectedLineIsVirtual}
        />
        <hr className="separator" />

        {/* Admin Panel - only for admin role */}
        {archiveType === 'admin' && user?.role === 'admin' && (
          <AdminPanel />
        )}

        {/* Accidents report — full width */}
        {archiveType === 'accidents' && <AccidentsPage />}

        {/* GRS Trends — full width */}
        {archiveType === 'grs-trends' && <GRSTrendsPage />}

        {/* Night Consumption — full width */}
        {archiveType === 'night-consumption' && <NightConsumptionPage />}

        {/* Hide DateTimePickers and TreeView when Overview, Poll, Admin or report pages are active */}
        {archiveType !== 'overview' && archiveType !== 'poll' && archiveType !== 'admin' &&
         archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption' && (
          <>
            <DateTimePickers
              onDateRangeChange={handleDateRangeChange}
              onDateFilterToggle={handleDateFilterToggle}
              archiveType={archiveType}
              initialDateRange={dateRange}
              initialEnabled={isDateFilterEnabled}
            />
            <hr className="separator" />
          </>
        )}

        {/* Overview Tab - full width when active */}
        {archiveType === 'overview' && (
          <OverviewTab />
        )}

        {/* Enterprise Poll Analysis Tab - full width when active */}
        {archiveType === 'poll' && (
          <EnterprisePollAnalysis />
        )}

        {/* Standard layout for other archive types */}
        {archiveType !== 'overview' && archiveType !== 'poll' && archiveType !== 'admin' &&
         archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption' && (
          <>
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
                  isVirtualLine={selectedLineIsVirtual}
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
                isVirtualLine={selectedLineIsVirtual}
              />
            )}
          </>
        )}
      </div>

</div>
  )
}

export default App