import React, { useState, useEffect } from 'react';
import './TreeView.css';
import { dataApi } from '../services/api';

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

const TreeView = ({ onLinesSelected }) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transform flat data into hierarchical structure
  const buildTreeStructure = (flatData) => {
    if (!flatData || flatData.length === 0) {
      return [];
    }


    // Group data by gas_volume_calc_id
    const groups = {};
    const lines = [];

    flatData.forEach(item => {

      if (item.name_gas_volume && item.gas_volume_calc_id) {
        // This is a gas volume calculation group
        if (!groups[item.gas_volume_calc_id]) {
          groups[item.gas_volume_calc_id] = {
            id: item.gas_volume_calc_id,
            name_gas_volume: item.name_gas_volume,
            gas_volume_calc_id: item.gas_volume_calc_id,
            children: []
          };
        }
      }

      // This is always a line
      const lineData = {
        id: item.id,
        name: item.name,
        gas_volume_calc_id: item.gas_volume_calc_id,
        address: item.address,
        line: item.line
      };
      lines.push(lineData);
    });

    // Assign lines to their groups
    lines.forEach(line => {
      if (line.gas_volume_calc_id && groups[line.gas_volume_calc_id]) {
        groups[line.gas_volume_calc_id].children.push(line);
      } else {
      }
    });

    // Convert to array and filter out empty groups
    const treeStructure = Object.values(groups).filter(group => group.children.length > 0);

    return treeStructure;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {

        // First, get gas volume groups (metering nodes)
        const gasVolumeGroups = await dataApi.getGasVolumeCalcs();

        // Then, get all lines
        const allLines = await dataApi.getLines();

        // Build tree structure correctly
        const treeStructure = gasVolumeGroups.map(group => {
          // Find lines that belong to this gas volume group
          const groupLines = allLines.filter(line => line.gas_volume_calc_id === group.id);


          return {
            id: group.id,
            name_gas_volume: group.name,
            gas_volume_calc_id: group.id,
            children: groupLines.map(line => ({
              id: line.id,
              name: line.name,
              gas_volume_calc_id: line.gas_volume_calc_id,
              address: line.address,
              line: line.line,
              meter: line.meter
            }))
          };
        }).filter(group => group.children.length > 0); // Only show groups that have lines


        if (!treeStructure || treeStructure.length === 0) {
          setError('Нет данных для отображения');
          setTreeData([]);
          return;
        }

        setTreeData(treeStructure);

        // Collapse all groups by default
        setExpandedGroups(new Set());

      } catch (error) {
        setError(`Ошибка загрузки данных: ${error.message}`);
        setTreeData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      return newExpanded;
    });
  };

  const toggleLineSelection = (lineId) => {
    setSelectedItem(prev => {
      const newSelection = prev === lineId ? null : lineId;
      return newSelection;
    });
  };

  // Use useEffect to notify parent when selection changes
  useEffect(() => {
    if (onLinesSelected) {
      onLinesSelected(selectedItem ? [selectedItem] : []);
    }
  }, [selectedItem, onLinesSelected]);

  const isGroupExpanded = (groupId) => expandedGroups.has(groupId);
  const isLineSelected = (lineId) => selectedItem === lineId;

  if (loading) {
    return (
      <div className="tree-view">
        <div className="tree-header">
          <h6>Список узлов учета</h6>
        </div>
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tree-view">
        <div className="tree-header">
          <h6>Список узлов учета</h6>
        </div>
        <div className="error">Ошибка загрузки данных</div>
      </div>
    );
  }

  return (
    <div className="tree-view">
      <div className="tree-header">
        <h6>Список узлов учета</h6>
      </div>
      <div className="tree-content">
        {treeData.map((group, groupIndex) => (
          <div key={`group-${group.id}-${groupIndex}`} className="tree-group">
            <div
              className="group-header"
              onClick={() => toggleGroup(group.id)}
            >
              <span className={`expand-icon ${isGroupExpanded(group.id) ? 'expanded' : ''}`}>
                {isGroupExpanded(group.id) ? <FolderOpenIcon /> : <FolderClosedIcon />}
              </span>
              <span className="group-icon"><GasCalculatorIcon /></span>
              <span className="group-name">{group.name_gas_volume}</span>
            </div>

            {isGroupExpanded(group.id) && group.children && group.children.length > 0 && (
              <div className="group-children">
                {group.children.map((line, lineIndex) => (
                  <div
                    key={`line-${line.id}-${lineIndex}`}
                    className={`tree-line ${isLineSelected(line.id) ? 'selected' : ''}`}
                    onClick={() => toggleLineSelection(line.id)}
                  >
                    <span className="line-icon"><LineIcon selected={isLineSelected(line.id)} /></span>
                    <span className="line-name">{line.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="selection-info">
          Выбрана линия: ID {selectedItem}
        </div>
      )}
    </div>
  );
};

export default TreeView;