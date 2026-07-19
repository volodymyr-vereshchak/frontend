// Описи колонок архівних таблиць (DataTable) — чисті функції без стану.

export const EDIT_CHANNEL_NAMES = ["P", "T", "dP", "dPL", "Густ"];

// edit_name може містити шаблон "%s" (номер каналу в old/new value) —
// підставляємо людську назву каналу.
export function resolveEditName(editName, rawOldValue, rawNewValue) {
  if (!editName || !editName.includes('%s')) return editName;
  const isChannelIdx = (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < EDIT_CHANNEL_NAMES.length;
  const idx = isChannelIdx(rawOldValue) ? rawOldValue
             : isChannelIdx(rawNewValue) ? rawNewValue
             : null;
  const channelName = idx !== null ? EDIT_CHANNEL_NAMES[idx] : String(rawOldValue ?? '?');
  return editName.replace('%s', channelName);
}

/**
 * Колонки таблиці для заданого типу архіву.
 * `t` — функція перекладу; units/прапорці приходять із props лінії.
 */
export function getArchiveColumns({
  archiveType,
  isVirtualLine,
  isDpdLine,
  lineUnits,
  showOutputPressure,
  pressureUnit,
  dpUnit,
  t,
}) {
  // Meter lines store working volume (m³) in w_volume_dp; others store dP.
  const wVolumeDpLabel = lineUnits?.meter
    ? `${t('workingVolume')}, ${t('volumeUnit')}`
    : `${t('differentialPressure')}, ${dpUnit}`;

  switch (archiveType) {
    case 'daily':
    case 'hourly':
      // Для виртуальных линий - ТОЛЬКО period и volume
      if (isVirtualLine) {
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'volume', label: t('volume'), sortable: true, isSummable: true }
        ];
      }

      // ДПД-линии: объём + давление + температура (без dP/плотности/счётчиков)
      if (isDpdLine) {
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'volume', label: t('volume'), sortable: true, isSummable: true },
          { key: 'pressure', label: `${t('pressure')}, ${pressureUnit}`, sortable: true, isAveragable: true },
          { key: 'temperature', label: t('temperature'), sortable: true, isAveragable: true },
        ];
      }

      // Для физических линий - все колонки
      return [
        { key: 'period', label: t('period'), sortable: true },
        { key: 'volume', label: t('volume'), sortable: true, isSummable: true },
        { key: 'w_volume_dp', label: wVolumeDpLabel, sortable: true, isAveragable: true },
        { key: 'pressure', label: `${t('pressure')}, ${pressureUnit}`, sortable: true, isAveragable: true },
        ...(showOutputPressure
          ? [{ key: 'output_pressure', label: `${t('outputPressure')}, ${pressureUnit}`, sortable: true, isAveragable: true }]
          : []),
        { key: 'temperature', label: t('temperature'), sortable: true, isAveragable: true },
        { key: 'density', label: t('density'), sortable: true, isAveragable: true },
        { key: 'edit_counts', label: t('editCounts'), sortable: true, isSummable: true, tooltip: t('changesCount') },
        { key: 'sys_counts', label: t('sysCounts'), sortable: true, isSummable: true, tooltip: t('alarmsCount') }
      ];
    case 'edit':
      return [
        { key: 'period', label: t('period'), sortable: true },
        { key: 'edit_name', label: t('editType'), sortable: true },
        { key: 'old_value', label: t('oldValue'), sortable: true },
        { key: 'new_value', label: t('newValue'), sortable: true }
      ];
    case 'sys':
      return [
        { key: 'period', label: t('period'), sortable: true },
        { key: 'sys_name', label: t('operationType'), sortable: true },
        { key: 'volume', label: t('value'), sortable: true, isSummable: true }
      ];
    case 'param':
      return [
        { key: 'period', label: t('period'), sortable: true },
        { key: 'density', label: t('density'), sortable: true, isAveragable: true },
        { key: 'co2', label: 'CO2 (%)', sortable: true, isAveragable: true },
        { key: 'n2', label: 'N2 (%)', sortable: true, isAveragable: true },
        { key: 'D20', label: 'D20', sortable: true, isAveragable: true },
        { key: 'd20', label: 'd20', sortable: true, isAveragable: true },
        { key: 'cutoff', label: 'Cutoff', sortable: true, isAveragable: true },
        { key: 'roughness', label: 'Roughness', sortable: true, isAveragable: true },
        { key: 'max_dp', label: t('paramMaxDp'), sortable: true, isAveragable: true },
        { key: 'min_dp', label: t('paramMinDp'), sortable: true, isAveragable: true },
        { key: 'A0su', label: 'A0su', sortable: true, isAveragable: true },
        { key: 'A1su', label: 'A1su', sortable: true, isAveragable: true },
        { key: 'A2su', label: 'A2su', sortable: true, isAveragable: true },
        { key: 'A0pipe', label: 'A0pipe', sortable: true, isAveragable: true },
        { key: 'A1pipe', label: 'A1pipe', sortable: true, isAveragable: true },
        { key: 'A2pipe', label: 'A2pipe', sortable: true, isAveragable: true },
        { key: 'radius', label: t('paramRadius'), sortable: true, isAveragable: true },
        { key: 'su_year', label: t('paramSuYear'), sortable: true, isAveragable: true },
        { key: 'max_p', label: t('paramMaxP'), sortable: true, isAveragable: true },
        { key: 'min_p', label: t('paramMinP'), sortable: true, isAveragable: true },
        { key: 'max_t', label: t('paramMaxT'), sortable: true, isAveragable: true },
        { key: 'min_t', label: t('paramMinT'), sortable: true, isAveragable: true }
      ];
    default:
      return [];
  }
}
