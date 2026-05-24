/**
 * Утилиты для обработки и анализа аварий из системного архива
 */

// Коди 1–74: кінець аварії (парний до 129–202)
// Коди 128–200: початок аварії (парний до 1–72... тобто code-128)
// Коди 75–127, 201–254: standalone-сповіщення без пари
export function isAccidentStart(sys_type_id) {
  const code = sys_type_id & 0xFF;
  return code >= 128 && code <= 200;
}

export function isAccidentEnd(sys_type_id) {
  const code = sys_type_id & 0xFF;
  return code >= 1 && code <= 74;
}

export function isStandaloneCode(sys_type_id) {
  const code = sys_type_id & 0xFF;
  return (code >= 75 && code <= 127) || code >= 201;
}

export function getAccidentEndCode(startCode) {
  return startCode - 128;
}

export function getAccidentStartCode(endCode) {
  return endCode + 128;
}

/**
 * Вычисляет длительность между двумя датами
 * @param {Date|string} startTime - Время начала
 * @param {Date|string} endTime - Время конца
 * @returns {string} Форматированная длительность "HH:MM:SS"
 */
export function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const diffMs = end - start;

  if (diffMs < 0) return "00:00:00";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Парсит записи системного архива и формирует пары аварий (начало-конец)
 * @param {Array} sysData - Данные из /sys/ эндпоинта
 * @param {Object} dateRange - Диапазон дат {fromDate, toDate, startHour, endHour}
 * @returns {Array} Массив аварий с рассчитанными параметрами
 */
export function pairAccidents(sysData, dateRange) {
  if (!sysData || sysData.length === 0) {
    return [];
  }

  // Сортируем по времени
  const sortedData = [...sysData].sort((a, b) =>
    new Date(a.period) - new Date(b.period)
  );

  const accidents = [];
  const openAccidents = new Map();

  // Карта sys_type_id → sys_name для пошуку назви стартового коду при end_only
  const nameByTypeId = new Map(sysData.map(r => [r.sys_type_id, r.sys_name]));

  const periodStart = new Date(dateRange.fromDate);
  const periodEnd = new Date(dateRange.toDate);

  sortedData.forEach(record => {
    const sys_type_id = record.sys_type_id;

    if (isStandaloneCode(sys_type_id)) {
      // Standalone-сповіщення: без пари, без тривалості
      accidents.push({
        sys_type_id,
        sys_name: record.sys_name,
        startTime: record.period,
        endTime: record.period,
        startVolume: record.volume,
        endVolume: record.volume,
        line_id: record.line_id,
        type: 'standalone',
      });
    } else if (isAccidentStart(sys_type_id)) {
      // Початок аварії — зберігаємо як відкриту
      const endCode = getAccidentEndCode(sys_type_id);
      if (!openAccidents.has(endCode)) {
        openAccidents.set(endCode, []);
      }
      openAccidents.get(endCode).push({
        sys_type_id,
        sys_name: record.sys_name,
        startTime: record.period,
        startVolume: record.volume,
        line_id: record.line_id,
      });
    } else {
      // Кінець аварії (код 1–74)
      const endCode = sys_type_id;
      const openList = openAccidents.get(endCode);

      if (openList && openList.length > 0) {
        // Є відкрита авария — повна пара
        const openAccident = openList.shift();
        accidents.push({
          sys_type_id: openAccident.sys_type_id,
          sys_name: openAccident.sys_name,
          startTime: openAccident.startTime,
          endTime: record.period,
          startVolume: openAccident.startVolume,
          endVolume: record.volume,
          line_id: record.line_id,
          type: 'full',
        });
        if (openList.length === 0) {
          openAccidents.delete(endCode);
        }
      } else {
        // Немає відкритої — авария почалась до початку періоду
        const startTypeId = getAccidentStartCode(endCode);
        // Назва завжди від стартового коду; якщо його немає в даних — беремо з кінцевого
        const startName = nameByTypeId.get(startTypeId) ?? record.sys_name;
        accidents.push({
          sys_type_id: startTypeId,
          sys_name: startName,
          startTime: periodStart.toISOString(),
          endTime: record.period,
          startVolume: 0,
          endVolume: record.volume,
          line_id: record.line_id,
          type: 'end_only',
        });
      }
    }
  });

  // Обрабатываем незакрытые аварии (только начало)
  openAccidents.forEach(openList => {
    openList.forEach(openAccident => {
      accidents.push({
        sys_type_id: openAccident.sys_type_id,
        sys_name: openAccident.sys_name,
        startTime: openAccident.startTime,
        endTime: periodEnd.toISOString(),
        startVolume: openAccident.startVolume,
        endVolume: null,
        line_id: openAccident.line_id,
        type: 'start_only' // Только начало
      });
    });
  });

  return accidents;
}

/**
 * Вычисляет объем для аварии
 * @param {Object} accident - Объект аварии
 * @param {Array} dailyData - Данные суточного архива для расчета объемов
 * @returns {number} Объем аварии
 */
export function calculateAccidentVolume(accident, dailyData = []) {
  if (accident.type === 'full') {
    // Полная пара: объем = объем при начале
    return accident.startVolume || 0;
  } else if (accident.type === 'end_only') {
    // Только конец: объем = объем при конце - 0
    return accident.endVolume || 0;
  } else if (accident.type === 'start_only') {
    // Только начало: нужны данные суточного архива
    // Логика: берем объем за период из суточного архива и вычитаем объем при начале аварии

    const startTime = new Date(accident.startTime);
    const endTime = new Date(accident.endTime);

    // Получаем коммерческие сутки для расчета
    const commercialDays = getCommercialDaysInRange(startTime, endTime);

    let totalDailyVolume = 0;

    // Суммируем объемы из суточного архива за нужные дни
    commercialDays.forEach(day => {
      const dayRecord = dailyData.find(d => {
        const recordDate = new Date(d.period);
        return isSameCommercialDay(recordDate, day) && d.line_id === accident.line_id;
      });

      if (dayRecord && dayRecord.volume_stand_cond) {
        totalDailyVolume += dayRecord.volume_stand_cond;
      }
    });

    // Объем аварии = общий объем за период - объем при начале аварии
    return Math.max(0, totalDailyVolume - (accident.startVolume || 0));
  }

  return 0;
}

/**
 * Получает массив коммерческих суток в диапазоне
 * @param {Date} startTime - Начало периода
 * @param {Date} endTime - Конец периода
 * @returns {Array<Date>} Массив дат коммерческих суток
 */
function getCommercialDaysInRange(startTime, endTime) {
  const days = [];
  const current = new Date(startTime);

  // Определяем коммерческие сутки для начальной даты
  let commercialDay = getCommercialDay(current);
  days.push(new Date(commercialDay));

  // Добавляем все коммерческие сутки до конца периода
  while (commercialDay < endTime) {
    commercialDay.setDate(commercialDay.getDate() + 1);
    if (commercialDay <= endTime) {
      days.push(new Date(commercialDay));
    }
  }

  return days;
}

/**
 * Определяет коммерческие сутки для даты
 * Коммерческие сутки: с 7:00 текущего дня до 6:59 следующего
 * @param {Date} date - Дата для определения
 * @returns {Date} Дата начала коммерческих суток (7:00)
 */
function getCommercialDay(date) {
  const hour = date.getHours();
  const commercialDate = new Date(date);

  if (hour < 7) {
    // До 7:00 - относится к предыдущим суткам
    commercialDate.setDate(commercialDate.getDate() - 1);
  }

  commercialDate.setHours(7, 0, 0, 0);
  return commercialDate;
}

/**
 * Проверяет, относятся ли две даты к одним коммерческим суткам
 * @param {Date} date1 - Первая дата
 * @param {Date} date2 - Вторая дата
 * @returns {boolean}
 */
function isSameCommercialDay(date1, date2) {
  const day1 = getCommercialDay(date1);
  const day2 = getCommercialDay(date2);

  return day1.getTime() === day2.getTime();
}

/**
 * Группирует аварии по типам и суммирует данные
 * @param {Array} accidents - Массив аварий
 * @param {Array} dailyData - Данные суточного архива
 * @returns {Array} Сгруппированные аварии с деталями
 */
export function groupAccidentsByType(accidents, dailyData = []) {
  const grouped = {};

  accidents.forEach(accident => {
    const key = accident.sys_type_id;
    const standalone = accident.type === 'standalone';

    if (!grouped[key]) {
      grouped[key] = {
        sys_type_id: accident.sys_type_id,
        sys_name: accident.sys_name,
        isStandalone: standalone,
        occurrences: [],
        totalCount: 0,
        totalDuration: 0,
        totalVolume: 0,
      };
    }

    const durationMs = standalone ? 0 : (new Date(accident.endTime) - new Date(accident.startTime));
    const duration = standalone ? '—' : calculateDuration(accident.startTime, accident.endTime);
    const volume = calculateAccidentVolume(accident, dailyData);

    grouped[key].occurrences.push({
      startTime: accident.startTime,
      endTime: accident.endTime,
      duration,
      volume,
      type: accident.type,
      line_id: accident.line_id,
    });

    grouped[key].totalCount++;
    grouped[key].totalDuration += durationMs;
    grouped[key].totalVolume += volume;
  });

  Object.values(grouped).forEach(group => {
    if (group.isStandalone) {
      group.totalDurationFormatted = '—';
      return;
    }
    const hours = Math.floor(group.totalDuration / (1000 * 60 * 60));
    const minutes = Math.floor((group.totalDuration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((group.totalDuration % (1000 * 60)) / 1000);
    group.totalDurationFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  return Object.values(grouped);
}

/**
 * Фильтрует аварии по линии
 * @param {Array} accidents - Массив аварий
 * @param {number} lineId - ID линии (null для всех линий)
 * @returns {Array} Отфильтрованные аварии
 */
export function filterAccidentsByLine(accidents, lineId) {
  if (!lineId) {
    return accidents;
  }

  return accidents.filter(accident => accident.line_id === lineId);
}
