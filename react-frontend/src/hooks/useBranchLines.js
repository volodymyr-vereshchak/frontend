import { useState, useEffect, useMemo } from 'react';
import { branchApi, lumgApi, lineApi, virtualLinesApi } from '../services/api';

/**
 * Спільні дані звітів по філії: список філій + лумгів, вибрана філія та ВСІ
 * фізичні й віртуальні лінії цієї філії (обʼєкти з прапорцями
 * include_in_trends / include_in_report). Підмножини (тренд-лінії, звітні
 * лінії) компоненти виводять самі через useMemo.
 *
 * @param {boolean} enabled — завантажувати дані (напр., модалка відкрита)
 */
export function useBranchLines(enabled) {
  const [branches, setBranches] = useState([]);
  const [lumgs, setLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [physicalLines, setPhysicalLines] = useState([]);
  const [virtualLines, setVirtualLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);

  // Load branches + lumgs when enabled
  useEffect(() => {
    if (!enabled) return;
    Promise.all([branchApi.getAll(), lumgApi.getAll()])
      .then(([branchData, lumgData]) => {
        const list = Array.isArray(branchData) ? branchData : [];
        setBranches(list);
        setLumgs(Array.isArray(lumgData) ? lumgData : []);
        if (list.length > 0) setSelectedBranchId(prev => prev ?? list[0].id);
      })
      .catch(err => console.error('Failed to load branches/lumgs:', err));
  }, [enabled]);

  // Load ALL lines of the selected branch (physical via its lumgs + virtual)
  useEffect(() => {
    if (!enabled || !selectedBranchId) return;

    const load = async () => {
      setLinesLoading(true);
      try {
        const branchLumgIds = lumgs
          .filter(l => l.branch_id === selectedBranchId)
          .map(l => l.id);

        let phys = [];
        if (branchLumgIds.length > 0) {
          const arrays = await Promise.all(
            branchLumgIds.map(lid => lineApi.getLinesByLumg(lid))
          );
          phys = arrays.flat().filter(Boolean);
        }

        const virt = await virtualLinesApi
          .getByBranch(selectedBranchId)
          .catch(() => []);

        setPhysicalLines(phys);
        setVirtualLines(Array.isArray(virt) ? virt : []);
      } catch (err) {
        console.error('Error loading lines for branch:', err);
      } finally {
        setLinesLoading(false);
      }
    };

    load();
  }, [enabled, selectedBranchId, lumgs]);

  // id → name для всіх ліній філії
  const lineNames = useMemo(() => {
    const map = {};
    [...physicalLines, ...virtualLines].forEach(l => {
      map[l.id] = l.name || `Лінія ${l.id}`;
    });
    return map;
  }, [physicalLines, virtualLines]);

  return {
    branches,
    lumgs,
    selectedBranchId,
    setSelectedBranchId,
    physicalLines,
    virtualLines,
    lineNames,
    linesLoading,
  };
}
