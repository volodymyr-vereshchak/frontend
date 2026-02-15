export const ru = {
  // App title
  appTitle: "HostLib Viewer",

  // Menu items
  overview: "Обзор",
  daily: "Суточный",
  hourly: "Часовой",
  edit: "Изменения",
  sys: "Аварии",
  param: "Параметры",
  grs: "ГРС",

  // Archive types
  dailyArchive: "Суточный архив",
  hourlyArchive: "Часовой архив",
  editArchive: "Архив изменений",
  systemArchive: "Системный архив",
  parameters: "Параметры",

  // Table columns
  period: "Период",
  volume: "Объем",
  workingVolumePressure: "Раб. объем/перепад",
  pressure: "Давление",
  temperature: "Температура",
  density: "Плотность",
  editCounts: "И",
  sysCounts: "А",
  editType: "Тип изменения",
  oldValue: "Старое значение",
  newValue: "Новое значение",
  operationType: "Тип операции",

  // Tooltips
  changesCount: "Изменения",
  alarmsCount: "Аварии",

  // Actions
  selectLines: "Выберите линии для отображения данных",
  activateDate: "Активируйте фильтр по датам для загрузки данных",
  loading: "Загрузка...",
  noData: "Нет данных для отображения",
  loadingData: "Загрузка данных...",

  // Export
  records: "Записей",
  export: "Экспорт",
  excel: "Excel",
  noDataExport: "Нет данных для экспорта",
  exportError: "Ошибка при экспорте в Excel",

  // Summary
  total: "Итого:",

  // Error messages
  errorLoading: "Ошибка загрузки данных",

  // File names for export
  dailyArchiveFile: "суточный_архив",
  hourlyArchiveFile: "часовой_архив",
  editArchiveFile: "архив_изменений",
  systemArchiveFile: "архив_аварий",
  parametersFile: "параметры",

  // GRS Report
  grsReport: "Отчет ГРС",
  grsReportCalculations: "Отчет за 24 часа",
  grsTrends: "Тренды ГРС",
  nightConsumption: "Ночные расходы",
  nightConsumptionDescription: "Минимальный расход газа с 00:00 до 05:00 по каждой ГРС",
  nightConsumptionNetDescription: "Минимальный NET объем (без промышленности) с 00:00 до 05:00 по каждой ГРС",
  accidents: "Аварии",
  accidentsReport: "Отчет по авариям",
  accidentsDescription: "Анализ аварийных событий по линиям за выбранный период",
  accidentType: "Тип аварии",
  occurrenceCount: "Количество случаев",
  totalDuration: "Общая длительность",
  totalVolume: "Общий объем",
  accidentDetails: "Детали аварии",
  startTime: "Время начала",
  endTime: "Время конца",
  duration: "Длительность",
  noAccidentsFound: "Аварий не найдено",
  loadAccidentsData: "Загрузить данные",
  allLines: "Все линии",
  totalAccidents: "Всего аварий",
  accidentTypes: "Типов аварий",

  // Date/Time
  from: "С",
  to: "До",
  date: "Дата",
  time: "Время",

  // Additional translations for DataTable
  editType: "Тип изменения",
  oldValue: "Старое значение",
  newValue: "Новое значение",
  operationType: "Тип операции",

  // Chart labels
  chartTitle: "График данных",
  noChartData: "Нет данных для отображения графика",
  updatingChart: "Обновление графика...",
  renderingChart: "Отрисовка графика...",
  chartPreparation: "График готовится к отображению...",

  // Chart series labels
  volumeLabel: "Объем",
  workingVolumeDpLabel: "Раб. объем/перепад",
  pressureLabel: "Давление",
  temperatureLabel: "Температура",
  densityLabel: "Плотность",
  co2Label: "CO2 (%)",
  n2Label: "N2 (%)",
  maxPressureLabel: "Макс. давление",
  minPressureLabel: "Мин. давление",
  maxTemperatureLabel: "Макс. температура",
  minTemperatureLabel: "Мин. температура",
  oldValueLabel: "Старое значение",
  newValueLabel: "Новое значение",

  // TreeView
  nodeListTitle: "Список узлов учета",
  selectedLine: "Выбрана линия:",
  loadingError: "Ошибка загрузки данных",
  noDataToDisplay: "Нет данных для отображения",

  // Date pickers
  periodStart: "Начало периода",
  periodEnd: "Конец периода",
  selectDateTime: "Выберите дату и время",
  today: "Сегодня",
  setToday: "Установить текущую дату",

  // GRS Report errors and messages
  calculationError: "Ошибка при расчете отчета",
  unknownReportError: "Неизвестная ошибка при получении отчета",
  serverConnectionError: "Ошибка подключения к серверу",
  grsVolumeTitle: "Объем по ГРС за последние 24 часа",
  grsTotalVolume: "ГРС всего",
  unknownDataFormat: "Неизвестный формат данных",
  volumeUnit: "м³",
  pressureUnit: "кг/см²",
  volume: "Объем",
  pressureIn: "Pвх",
  pressureOut: "Pвых",
  noGrsLinesConfigured: "Не настроены линии ГРС",
  noDataAvailable: "Нет доступных данных",
  errorLoadingData: "Ошибка загрузки данных",
  noDataForPeriod: "Нет данных за выбранный период",
  refresh: "Обновить",
  close: "Закрыть",
  exportToExcel: "Экспорт в Excel",
  errorExportingData: "Ошибка при экспорте данных",
  error: "Ошибка",
  selectPeriod: "Выберите период",
  calculatingTrends: "Расчет трендов...",
  grsConsumptionTrends: "Тренды потребления ГРС",
  grsTracksDescription: "График показывает процентное распределение потребления газа по каждой ГРС относительно общего объема за период",

  // Enterprise Overlay
  enterpriseOverlay: "Промышленность",
  enterpriseNetVolumeInfo: "Показывается Net Volume (разница между объемом линии и промышленностью) и Total Enterprise",
  loadingEnterpriseData: "Загрузка данных предприятий...",
  netVolume: "Net Volume (Линия - Предприятия)",
  totalEnterpriseVolume: "Суммарный объем предприятий",
  enterpriseNoData: "Нет данных по предприятиям за выбранный период",

  // Virtual Lines
  virtualLines: "Виртуальные линии",
  virtualLineTooltip: "Виртуальная линия (агрегация нескольких физических линий)",
  notAvailableForVirtualLines: "Недоступно для виртуальных линий",
  virtualLinesSupportOnlyDailyHourly: "Виртуальные линии поддерживают только суточный и часовой архивы",

  // Overview Tab
  grsOverviewTitle: "Обзор ГРС",
  lastUpdate: "Последнее обновление",
  total24hVolume: "Общий объем за 24 часа",
  comparedToPrevious: "по сравнению с предыдущими 24ч",
  linePressures: "Давление по линиям",
  hourlyFlowRates: "Часовые расходы",
  lastHour: "Последний час",
  previousHour: "Предыдущий час",
  change: "Изменение",
  volumeComparison24h: "Сравнение объемов за 24ч",
  current24h: "Текущие 24ч",
  previous24h: "Предыдущие 24ч",
  refreshNow: "Обновить",
  autoRefresh: "Авто-обновление",
  activeLines: "Активные линии",
  nextRefreshIn: "Следующее обновление через",
  lineName: "Линия",
  flowRate: "Расход",

  // Short versions for compact tables
  lastHourShort: "Посл. час",
  previousHourShort: "Пред. час",
  current24hShort: "Тек. 24ч",
  previous24hShort: "Пред. 24ч",
  changeShort: "Δ",

  // Differential Pressure (dP)
  differentialPressure: "Перепад давления",
  differentialPressureShort: "dP",
  dpRange: "Диапазон dP",
  currentDp: "Текущий dP",
  flowInWorkingConditions: "Расход в р.у.",
  currentValue: "Текущее",
  maxValue24h: "Макс. 24ч",

  // Enterprise Poll Analysis
  enterprisePoll: "Опрос предприятий",
  unpolledEnterprises: "Нет опроса",
  searchEnterprise: "Поиск предприятия...",
  pollResults: "Результаты опроса",
  dailyPoll: "Суточный",
  hourlyPoll: "Часовой",
  poll: "Опросить",
  selectEnterprise: "Выберите предприятие",
  noPollData: "Нет данных опроса",
  enterpriseList: "Список предприятий",
  pollDate: "Дата опроса",
  totalEnterprises: "Всего предприятий",
  activeEnterprises: "Активных",
  unpolledCount: "Не опрошенных",
  lastPollDate: "Последний опрос",
  neverPolled: "Не опрашивалось",
  pollError: "Ошибка опроса",
  loadingEnterprises: "Загрузка предприятий...",
  noEnterpriseSelected: "Выберите предприятие для просмотра данных",
  enterpriseVolumeChart: "График объемов",
  showVolume: "Объем",
  showTemperature: "Температура",
  showPressure: "Давление",
  withoutLine: "Без линии",
  correctorType: "Тип корректора",
  correctorNumber: "Номер корректора",
  exportExcel: "Экспорт в Excel"
};