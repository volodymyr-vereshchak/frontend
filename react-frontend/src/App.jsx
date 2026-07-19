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
import FlowRateCalcPage from './components/FlowRateCalcPage'
import LoginPage from './components/LoginPage/LoginPage'
import MobileApp from './mobile/MobileApp'
import { useIsMobile } from './hooks/useIsMobile'
import { LanguageProvider } from './contexts/LanguageContext'
import { UserProvider } from './contexts/UserContext'
import { useUser } from './contexts/UserContext'
function safeSetItem(key, value) {
  const s = JSON.stringify(value);
  try { localStorage.setItem(key, s); } catch {}
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
  const [selectedLineIsDpd, setSelectedLineIsDpd] = useState(false);
  const [selectedLineUnits, setSelectedLineUnits] = useState(null);

  // Drop entries of the removed browser-side enterprise cache on startup
  // (the server archive is the single source of enterprise data now).
  useEffect(() => {
    for (const k of Object.keys(localStorage)) {
      if (['ent4_', 'ent3_', 'ent2_', 'ent_'].some(p => k.startsWith(p))) {
        localStorage.removeItem(k);
      }
    }
  }, []);

  useEffect(() => {
    if (archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption' && archiveType !== 'flow-calc') {
      safeSetItem('hlv-active-tab', archiveType);
    }
  }, [archiveType]);

  useEffect(() => {
    safeSetItem('hlv-selected-line', selectedLines[0] ?? null);
  }, [selectedLines]);

  // Auto-switch to daily archive when a virtual or DPD line is selected with a
  // non-allowed archive type (both kinds only have daily/hourly data)
  useEffect(() => {
    if (selectedLineIsVirtual || selectedLineIsDpd) {
      // Виртуальные и ДПД линии поддерживают только daily, hourly, overview, poll, admin
      if (archiveType !== 'daily' && archiveType !== 'hourly' && archiveType !== 'overview' &&
          archiveType !== 'poll' && archiveType !== 'admin' && archiveType !== 'accidents' &&
          archiveType !== 'grs-trends' && archiveType !== 'night-consumption' && archiveType !== 'flow-calc') {
        setArchiveType('daily');
      }
    }
  }, [selectedLineIsVirtual, selectedLineIsDpd, archiveType]);

  const handleLinesSelected = useCallback((lineIds, lineMetadata) => {
    setSelectedLines(lineIds);
    if (lineIds.length > 0) setLineIdFromURL(lineIds[0]);

    // Определить, является ли выбранная линия виртуальной
    if (lineIds && lineIds.length > 0) {
      const firstLineId = lineIds[0];
      const isVirtual = lineMetadata?.is_virtual === true;
      const isDpd = lineMetadata?.is_dpd === true;
      setSelectedLineIsVirtual(isVirtual);
      setSelectedLineIsDpd(isDpd);
      setSelectedLineUnits(
        lineMetadata && !lineMetadata.is_virtual && !lineMetadata.is_dpd
          ? {
              meter: lineMetadata.meter,
              is_high_pressure: lineMetadata.is_high_pressure,
              pressure_unit: lineMetadata.pressure_unit,
              dp_unit: lineMetadata.dp_unit,
            }
          : null
      );
    } else {
      setSelectedLineIsVirtual(false);
      setSelectedLineIsDpd(false);
      setSelectedLineUnits(null);
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

  // On phones, render the dedicated mobile shell (override with ?desktop=1).
  const isMobile = useIsMobile();
  if (isMobile) {
    return <MobileApp />;
  }

  return (
      <div className="App">
      <div className="app-container">
        <TopMenu
          onArchiveTypeChange={handleArchiveTypeChange}
          archiveType={archiveType}
          isVirtualLine={selectedLineIsVirtual || selectedLineIsDpd}
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

        {/* Flow Rate Calculation — full width */}
        {archiveType === 'flow-calc' && <FlowRateCalcPage />}

        {/* Hide DateTimePickers and TreeView when Overview, Poll, Admin or report pages are active */}
        {archiveType !== 'overview' && archiveType !== 'poll' && archiveType !== 'admin' &&
         archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption' &&
         archiveType !== 'flow-calc' && (
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
         archiveType !== 'accidents' && archiveType !== 'grs-trends' && archiveType !== 'night-consumption' &&
         archiveType !== 'flow-calc' && (
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
                  isDpdLine={selectedLineIsDpd}
                  lineUnits={selectedLineUnits}
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
                isDpdLine={selectedLineIsDpd}
                lineUnits={selectedLineUnits}
              />
            )}
          </>
        )}
      </div>

</div>
  )
}

export default App