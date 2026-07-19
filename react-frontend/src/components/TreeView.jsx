import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './TreeView.css';
import { branchApi, lumgApi, lineApi, dataApi, virtualLinesApi, virtualLinesHelper, calcTypeApi, dpdLineApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

// SVG Icon Components
const FolderClosedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L3 18C3 19.1046 3.89543 20 5 20L19 20C20.1046 20 21 19.1046 21 18L21 10C21 8.89543 20.1046 8 19 8L13 8L11 6L5 6C3.89543 6 3 6.89543 3 8Z" fill="#FFB74D" stroke="#FF9800" strokeWidth="1"/>
  </svg>
);

const FolderOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L3 18C3 19.1046 3.89543 20 5 20L19 20C20.1046 20 21 19.1046 21 18L21 10C21 8.89543 20.1046 8 19 8L13 8L11 6L5 6C3.89543 6 3 6.89543 3 8Z" fill="#FFD54F" stroke="#FFC107" strokeWidth="1"/>
    <path d="M3 12L21 12" stroke="#FFC107" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const BranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="18" height="13" rx="2" fill="#7986CB" stroke="#5C6BC0" strokeWidth="1"/>
    <rect x="7" y="3" width="10" height="5" rx="1" fill="#9FA8DA" stroke="#7986CB" strokeWidth="1"/>
    <rect x="6" y="12" width="3" height="4" fill="#fff" opacity="0.7"/>
    <rect x="10.5" y="12" width="3" height="4" fill="#fff" opacity="0.7"/>
    <rect x="15" y="12" width="3" height="4" fill="#fff" opacity="0.7"/>
  </svg>
);

const LumgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" rx="2" fill="#4DB6AC" stroke="#26A69A" strokeWidth="1"/>
    <circle cx="12" cy="10" r="3" fill="#fff" opacity="0.8"/>
    <rect x="9" y="14" width="6" height="2" rx="1" fill="#fff" opacity="0.6"/>
    <rect x="10" y="17" width="4" height="1.5" rx="0.5" fill="#fff" opacity="0.5"/>
  </svg>
);

const GasCalculatorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4FC3F7" stroke="#29B6F6" strokeWidth="1"/>
    <circle cx="8" cy="8" r="1.5" fill="#0277BD"/>
    <circle cx="16" cy="8" r="1.5" fill="#0277BD"/>
    <circle cx="8" cy="16" r="1.5" fill="#0277BD"/>
    <circle cx="16" cy="16" r="1.5" fill="#0277BD"/>
    <path d="M12 6V18M6 12H18" stroke="#0277BD" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const LineIcon = ({ selected = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="12" r="3" fill={selected ? "#ffffff" : "#81C784"} stroke={selected ? "#ffffff" : "#4CAF50"} strokeWidth="1"/>
    <circle cx="18" cy="12" r="3" fill={selected ? "#ffffff" : "#81C784"} stroke={selected ? "#ffffff" : "#4CAF50"} strokeWidth="1"/>
    <path d="M9 12H15" stroke={selected ? "#ffffff" : "#4CAF50"} strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 12H6M18 12H21" stroke={selected ? "#ffffff" : "#4CAF50"} strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const CollapseAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8L3 18C3 19.1046 3.89543 20 5 20L19 20C20.1046 20 21 19.1046 21 18L21 10C21 8.89543 20.1046 8 19 8L13 8L11 6L5 6C3.89543 6 3 6.89543 3 8Z" fill="#FFB74D" stroke="#FF9800" strokeWidth="1"/>
    <path d="M9 14L12 11L15 14" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const VirtualLineIcon = ({ selected = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="12" cy="12" r="9"
      fill="none"
      stroke={selected ? "#ffffff" : "#9C27B0"}
      strokeWidth="1.5"
      strokeDasharray="2 2"
    />
    <circle cx="8" cy="10" r="2" fill={selected ? "#ffffff" : "#BA68C8"} />
    <circle cx="16" cy="10" r="2" fill={selected ? "#ffffff" : "#BA68C8"} />
    <circle cx="12" cy="16" r="2" fill={selected ? "#ffffff" : "#BA68C8"} />
  </svg>
);

const DpdLineIcon = ({ selected = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Antenna/telemetry: corrector polled remotely over the DPD API */}
    <path
      d="M6 9C7.5 7.5 9.5 6.5 12 6.5C14.5 6.5 16.5 7.5 18 9"
      stroke={selected ? "#ffffff" : "#29B6F6"} strokeWidth="1.5" strokeLinecap="round" fill="none"
    />
    <path
      d="M8 12C9 11 10.5 10.5 12 10.5C13.5 10.5 15 11 16 12"
      stroke={selected ? "#ffffff" : "#29B6F6"} strokeWidth="1.5" strokeLinecap="round" fill="none"
    />
    <circle cx="12" cy="15" r="2" fill={selected ? "#ffffff" : "#4FC3F7"} />
    <path d="M12 17V20" stroke={selected ? "#ffffff" : "#29B6F6"} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TreeView = ({ onLinesSelected, initialLineId }) => {
  const { t } = useLanguage();
  const [treeData, setTreeData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null); // { name, gvcName, address, line, is_virtual }
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('hlv-tree-expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  // True once the user has explicitly touched the tree state — auto-expand to
  // initialLineId only on first-ever load, then respect manual expand/collapse.
  const userHasTreeState = useRef(localStorage.getItem('hlv-tree-expanded') !== null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const treeDataRef = useRef([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [branches, lumgs, gvcs, calcTypes, allLines, virtualLines, dpdLines] = await Promise.all([
          branchApi.getAll(),
          lumgApi.getAll(),
          dataApi.getGasVolumeCalcs(),
          calcTypeApi.getAll(),
          lineApi.getAll(),
          virtualLinesApi.getVisibleLines(),
          dpdLineApi.getAll().catch(() => []),
        ]);

        const calcTypeMap = {};
        (calcTypes || []).forEach(ct => { calcTypeMap[ct.id] = ct.type_name; });

        // Group virtual and DPD lines by lumg_id; null-lumg_id entries by
        // branch_id. Both kinds live in the same per-LUMG list under the
        // calculators — they only differ by flags/icon and data endpoints.
        const virtualByLumg = {};
        const virtualByBranchForNull = {};
        const extraLines = [
          ...(virtualLines || [])
            .filter(l => virtualLinesHelper.isVirtualLineObject(l))
            .map(vl => ({ ...vl, is_virtual: true, is_dpd: false })),
          ...(dpdLines || [])
            .filter(l => l.active !== false)
            .map(dl => ({
              id: dl.id,
              name: dl.name,
              lumg_id: dl.lumg_id,
              branch_id: dl.branch_id,
              is_virtual: false,
              is_dpd: true,
            })),
        ];
        extraLines.forEach(vl => {
            if (vl.lumg_id) {
              if (!virtualByLumg[vl.lumg_id]) virtualByLumg[vl.lumg_id] = [];
              virtualByLumg[vl.lumg_id].push(vl);
            } else {
              const bKey = vl.branch_id || 0;
              if (!virtualByBranchForNull[bKey]) virtualByBranchForNull[bKey] = [];
              virtualByBranchForNull[bKey].push(vl);
            }
          });

        const treeStructure = [];

        // Build Branch → LUMG → GVC → Line hierarchy
        const lumgsByBranch = {};
        (lumgs || []).forEach(lumg => {
          const bid = lumg.branch_id;
          if (!lumgsByBranch[bid]) lumgsByBranch[bid] = [];
          lumgsByBranch[bid].push(lumg);
        });

        const gvcsByLumg = {};
        (gvcs || []).forEach(gvc => {
          const lid = gvc.lumg_id;
          if (!gvcsByLumg[lid]) gvcsByLumg[lid] = [];
          gvcsByLumg[lid].push(gvc);
        });

        const linesByGvc = {};
        (allLines || []).forEach(line => {
          const gid = line.gas_volume_calc_id;
          if (!linesByGvc[gid]) linesByGvc[gid] = [];
          linesByGvc[gid].push(line);
        });

        (branches || []).forEach(branch => {
          const branchLumgs = lumgsByBranch[branch.id] || [];
          let isFirstLumg = true;

          const lumgNodes = branchLumgs.map(lumg => {
            const lumgGvcs = gvcsByLumg[lumg.id] || [];

            const gvcNodes = lumgGvcs.map(gvc => {
              const gvcLines = linesByGvc[gvc.id] || [];
              return {
                type: 'gvc',
                id: `gvc-${gvc.id}`,
                gvcId: gvc.id,
                name: gvc.name,
                address: gvc.address,
                typeName: gvc.type_id ? (calcTypeMap[gvc.type_id] || null) : null,
                children: gvcLines.map(line => ({
                  id: line.id,
                  name: line.name,
                  gas_volume_calc_id: line.gas_volume_calc_id,
                  is_virtual: false,
                  address: line.address,
                  line: line.line,
                  meter: line.meter,
                  is_high_pressure: line.is_high_pressure,
                  pressure_unit: line.pressure_unit,
                  dp_unit: line.dp_unit,
                })),
              };
            }).filter(g => g.children.length > 0);

            // Collect virtual lines for this LUMG + fallback for first LUMG
            const lumgVirtuals = [
              ...(virtualByLumg[lumg.id] || []),
              ...(isFirstLumg ? (virtualByBranchForNull[branch.id] || []) : []),
            ];
            isFirstLumg = false;

            return {
              type: 'lumg',
              id: `lumg-${lumg.id}`,
              lumgId: lumg.id,
              name: lumg.name,
              children: gvcNodes,
              virtualLines: lumgVirtuals,
            };
          }).filter(l => l.children.length > 0 || l.virtualLines.length > 0);

          if (lumgNodes.length > 0) {
            treeStructure.push({
              type: 'branch',
              id: `branch-${branch.id}`,
              branchId: branch.id,
              name: branch.name,
              children: lumgNodes,
            });
          }
        });

        if (treeStructure.length === 0) {
          setError(t('noDataToDisplay'));
          setTreeData([]);
          return;
        }

        setTreeData(treeStructure);
        treeDataRef.current = treeStructure;

      } catch (err) {
        setError(`${t('loadingError')}: ${err.message}`);
        setTreeData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── Search filter ────────────────────────────────────────────────────────────
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return treeData;

    const filterLines = (lines) => lines.filter(l => l.name.toLowerCase().includes(q));

    return treeData.flatMap(branch => {
      const branchMatch = branch.name.toLowerCase().includes(q);

      const filteredLumgs = (branch.children || []).flatMap(lumg => {
        const lumgMatch = lumg.name.toLowerCase().includes(q);

        const filteredGvcs = (lumg.children || []).flatMap(gvc => {
          const gvcMatch = gvc.name.toLowerCase().includes(q);
          const lines = gvcMatch ? gvc.children : filterLines(gvc.children);
          return (gvcMatch || lines.length > 0) ? [{ ...gvc, children: lines }] : [];
        });

        const filteredVirtuals = lumgMatch
          ? (lumg.virtualLines || [])
          : filterLines(lumg.virtualLines || []);

        if (lumgMatch || filteredGvcs.length > 0 || filteredVirtuals.length > 0) {
          return [{
            ...lumg,
            children: lumgMatch ? lumg.children : filteredGvcs,
            virtualLines: filteredVirtuals,
          }];
        }
        return [];
      });

      if (branchMatch || filteredLumgs.length > 0) {
        return [{ ...branch, children: branchMatch ? branch.children : filteredLumgs }];
      }
      return [];
    });
  }, [treeData, searchQuery]);

  // When searching — treat all nodes as expanded; otherwise use saved state
  const isExpanded = (id) => searchQuery.trim() ? true : expandedGroups.has(id);

  const toggleGroup = (id) => {
    userHasTreeState.current = true;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCollapseAll = () => {
    userHasTreeState.current = true;
    setExpandedGroups(new Set());
    setSelectedItem(null);
    setSelectedMeta(null);
  };

  useEffect(() => {
    try { localStorage.setItem('hlv-tree-expanded', JSON.stringify([...expandedGroups])); } catch {}
  }, [expandedGroups]);

  // Notify parent on selection change
  useEffect(() => {
    if (!onLinesSelected) return;
    let lineMetadata = null;
    if (selectedItem) {
      outer: for (const node of treeDataRef.current) {
        if (node.type === 'branch') {
          for (const lumg of node.children || []) {
            const vline = lumg.virtualLines?.find(c => c.id === selectedItem);
            if (vline) { lineMetadata = { is_virtual: !vline.is_dpd, is_dpd: !!vline.is_dpd }; break outer; }
            for (const gvc of lumg.children || []) {
              const line = gvc.children?.find(c => c.id === selectedItem);
              if (line) {
                lineMetadata = {
                  is_virtual: false,
                  meter: line.meter,
                  is_high_pressure: line.is_high_pressure,
                  pressure_unit: line.pressure_unit,
                  dp_unit: line.dp_unit,
                };
                break outer;
              }
            }
          }
        }
      }
    }
    onLinesSelected(selectedItem ? [selectedItem] : [], lineMetadata);
  }, [selectedItem, onLinesSelected]);

  // Restore selection from initialLineId on mount. Tree path expansion is
  // applied only on first-ever load — once the user has touched tree state,
  // their manual collapse/expand is respected.
  useEffect(() => {
    if (!initialLineId || treeData.length === 0 || hasInitialized || loading) return;
    const shouldExpand = !userHasTreeState.current;

    for (const node of treeData) {
      if (node.type === 'branch') {
        for (const lumg of node.children || []) {
          const vline = lumg.virtualLines?.find(c => c.id === initialLineId);
          if (vline) {
            if (shouldExpand) {
              setExpandedGroups(prev => {
                const n = new Set(prev);
                n.add(node.id); n.add(lumg.id);
                return n;
              });
            }
            setSelectedItem(initialLineId);
            setSelectedMeta({ name: vline.name, typeName: null, address: null, line: vline.line || null, is_virtual: !vline.is_dpd, is_dpd: !!vline.is_dpd });
            setHasInitialized(true);
            return;
          }
          for (const gvc of lumg.children || []) {
            const line = gvc.children?.find(c => c.id === initialLineId);
            if (line) {
              if (shouldExpand) {
                setExpandedGroups(prev => {
                  const n = new Set(prev);
                  n.add(node.id); n.add(lumg.id); n.add(gvc.id);
                  return n;
                });
              }
              setSelectedItem(initialLineId);
              setSelectedMeta({ name: line.name, branchName: node.name || null, gvcName: gvc.name || null, typeName: gvc.typeName || null, address: gvc.address ?? null, line: line.line || null, is_virtual: false });
              setHasInitialized(true);
              return;
            }
          }
        }
      }
    }

    setHasInitialized(true);
  }, [initialLineId, treeData, hasInitialized, loading]);

  const isSelected = (id) => selectedItem === id;

  const renderLines = (lines, gvcMeta = null) => lines.map((line, i) => (
    <div
      key={`line-${line.id}-${i}`}
      className={`tree-line ${isSelected(line.id) ? 'selected' : ''} ${line.is_virtual ? 'virtual-line' : ''} ${line.is_dpd ? 'dpd-line' : ''}`}
      onClick={() => {
        const next = selectedItem === line.id ? null : line.id;
        setSelectedItem(next);
        setSelectedMeta(next ? {
          name: line.name,
          branchName: gvcMeta?.branchName || null,
          gvcName: gvcMeta?.name || null,
          typeName: gvcMeta?.typeName || null,
          address: gvcMeta?.address ?? null,
          line: line.line || null,
          is_virtual: line.is_virtual,
          is_dpd: !!line.is_dpd,
        } : null);
      }}
      title={line.is_dpd ? t('dpdLineTooltip') : line.is_virtual ? t('virtualLineTooltip') : line.name}
    >
      <span className="line-icon">
        {line.is_dpd
          ? <DpdLineIcon selected={isSelected(line.id)} />
          : line.is_virtual
            ? <VirtualLineIcon selected={isSelected(line.id)} />
            : <LineIcon selected={isSelected(line.id)} />}
      </span>
      <span className="line-name">{line.name}</span>
      {line.is_virtual && <span className="virtual-badge">V</span>}
      {line.is_dpd && <span className="virtual-badge dpd-badge">D</span>}
    </div>
  ));

  const renderGvc = (gvc, branchName) => (
    <div key={gvc.id} className="tree-group" style={{ paddingLeft: 8 }}>
      <div className="group-header" onClick={() => toggleGroup(gvc.id)}>
        <span className={`expand-icon ${isExpanded(gvc.id) ? 'expanded' : ''}`}>
          {isExpanded(gvc.id) ? <FolderOpenIcon /> : <FolderClosedIcon />}
        </span>
        <span className="group-icon"><GasCalculatorIcon /></span>
        <span className="group-name">{gvc.name}</span>
      </div>
      {isExpanded(gvc.id) && gvc.children.length > 0 && (
        <div className="group-children">
          {renderLines(gvc.children, { branchName, name: gvc.name, typeName: gvc.typeName, address: gvc.address })}
        </div>
      )}
    </div>
  );

  const renderLumg = (lumg, branchName) => {
    const hasContent = lumg.children.length > 0 || (lumg.virtualLines || []).length > 0;
    return (
      <div key={lumg.id} className="tree-group" style={{ paddingLeft: 8 }}>
        <div className="group-header" onClick={() => toggleGroup(lumg.id)}>
          <span className={`expand-icon ${isExpanded(lumg.id) ? 'expanded' : ''}`}>
            {isExpanded(lumg.id) ? <FolderOpenIcon /> : <FolderClosedIcon />}
          </span>
          <span className="group-icon"><LumgIcon /></span>
          <span className="group-name">{lumg.name}</span>
        </div>
        {isExpanded(lumg.id) && hasContent && (
          <div className="group-children">
            {lumg.children.map(gvc => renderGvc(gvc, branchName))}
            {renderLines(lumg.virtualLines || [], null)}
          </div>
        )}
      </div>
    );
  };

  const renderBranch = (branch) => (
    <div key={branch.id} className="tree-group">
      <div className="group-header" onClick={() => toggleGroup(branch.id)}>
        <span className={`expand-icon ${isExpanded(branch.id) ? 'expanded' : ''}`}>
          {isExpanded(branch.id) ? <FolderOpenIcon /> : <FolderClosedIcon />}
        </span>
        <span className="group-icon"><BranchIcon /></span>
        <span className="group-name">{branch.name}</span>
      </div>
      {isExpanded(branch.id) && branch.children.length > 0 && (
        <div className="group-children">
          {branch.children.map(lumg => renderLumg(lumg, branch.name))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="tree-view">
        <div className="tree-header"><h6>{t('nodeListTitle')}</h6></div>
        <div className="loading">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tree-view">
        <div className="tree-header"><h6>{t('nodeListTitle')}</h6></div>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-header">
        <h6>{t('nodeListTitle')}</h6>
        <div className="tree-search-row">
          <input
            ref={searchInputRef}
            className="tree-search-input"
            type="text"
            placeholder={t('treeSearch')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="tree-collapse-btn"
            title={t('collapseAll')}
            onClick={handleCollapseAll}
          >
            <CollapseAllIcon />
          </button>
        </div>
      </div>
      <div className="tree-content">
        {filteredTree.map(node => {
          if (node.type === 'branch') return renderBranch(node);
          return null;
        })}
        {filteredTree.length === 0 && searchQuery.trim() && (
          <div className="no-results">{t('noDataToDisplay')}</div>
        )}
      </div>
      {selectedItem && (
        <div className="selection-info">
          <div className="selection-line-name">
            {selectedMeta?.is_virtual && <span className="virtual-badge">V</span>}
            {selectedMeta?.is_dpd && <span className="virtual-badge dpd-badge">D</span>}
            {selectedMeta?.name || `ID ${selectedItem}`}
          </div>
          <div className="selection-details-row">
            {selectedMeta?.branchName && (
              <span className="selection-chip">
                <span className="selection-label">{t('branch')}:</span>
                <span className="selection-value">{selectedMeta.branchName}</span>
              </span>
            )}
            {selectedMeta?.gvcName && (
              <span className="selection-chip">
                <span className="selection-label">{t('calcObject')}:</span>
                <span className="selection-value">{selectedMeta.gvcName}</span>
              </span>
            )}
            {selectedMeta?.typeName && (
              <span className="selection-chip">
                <span className="selection-label">{t('calculator')}:</span>
                <span className="selection-value">{selectedMeta.typeName}</span>
              </span>
            )}
            {selectedMeta?.address != null && (
              <span className="selection-chip">
                <span className="selection-label">{t('calcAddress')}:</span>
                <span className="selection-value">{selectedMeta.address}</span>
              </span>
            )}
            {selectedMeta?.line != null && (
              <span className="selection-chip">
                <span className="selection-label">{t('calcLine')}:</span>
                <span className="selection-value">{selectedMeta.line}</span>
              </span>
            )}
            <span className="selection-chip selection-chip--id">ID: {selectedItem}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeView;
