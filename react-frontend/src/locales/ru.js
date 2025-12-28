export const ru = {
  // App title
  appTitle: "HostLib Viewer",

  // Menu items
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
  virtualLinesSupportOnlyDailyHourly: "Виртуальные линии поддерживают только суточный и часовой архивы"
};