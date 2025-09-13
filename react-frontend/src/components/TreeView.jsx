import React, { useState, useEffect } from 'react';
import './TreeView.css';
import { dataApi } from '../services/api';

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

    console.log('Building tree from flat data:', flatData);

    // Group data by gas_volume_calc_id
    const groups = {};
    const lines = [];

    flatData.forEach(item => {
      console.log('Processing item:', item);

      if (item.name_gas_volume && item.gas_volume_calc_id) {
        // This is a gas volume calculation group
        if (!groups[item.gas_volume_calc_id]) {
          groups[item.gas_volume_calc_id] = {
            id: item.gas_volume_calc_id,
            name_gas_volume: item.name_gas_volume,
            gas_volume_calc_id: item.gas_volume_calc_id,
            children: []
          };
          console.log(`Created group: ${item.name_gas_volume} (ID: ${item.gas_volume_calc_id})`);
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
      console.log(`Added line: ${lineData.name} (ID: ${lineData.id}, Group: ${lineData.gas_volume_calc_id})`);
    });

    // Assign lines to their groups
    lines.forEach(line => {
      if (line.gas_volume_calc_id && groups[line.gas_volume_calc_id]) {
        groups[line.gas_volume_calc_id].children.push(line);
        console.log(`Assigned line "${line.name}" to group "${groups[line.gas_volume_calc_id].name_gas_volume}"`);
      } else {
        console.warn(`No group found for line: ${line.name} (gas_volume_calc_id: ${line.gas_volume_calc_id})`);
      }
    });

    // Convert to array and filter out empty groups
    const treeStructure = Object.values(groups).filter(group => group.children.length > 0);

    console.log('Final tree structure:', treeStructure);
    return treeStructure;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Fetching gas volume groups and lines data from API...');

        // First, get gas volume groups (metering nodes)
        const gasResponse = await fetch('/api/gas-volume-calcs/', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!gasResponse.ok) {
          throw new Error(`Gas volume API failed: ${gasResponse.status} ${gasResponse.statusText}`);
        }

        const gasVolumeGroups = await gasResponse.json();
        console.log('Gas volume groups (metering nodes):', gasVolumeGroups);

        // Then, get all lines
        const linesResponse = await fetch('/api/lines/', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!linesResponse.ok) {
          throw new Error(`Lines API failed: ${linesResponse.status} ${linesResponse.statusText}`);
        }

        const allLines = await linesResponse.json();
        console.log('All lines data:', allLines);

        // Build tree structure correctly
        const treeStructure = gasVolumeGroups.map(group => {
          // Find lines that belong to this gas volume group
          const groupLines = allLines.filter(line => line.gas_volume_calc_id === group.id);

          console.log(`Group "${group.name}" (ID: ${group.id}) has ${groupLines.length} lines:`, groupLines.map(l => l.name));

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

        console.log('Built tree structure:', treeStructure);

        if (!treeStructure || treeStructure.length === 0) {
          setError('Нет данных для отображения');
          setTreeData([]);
          return;
        }

        setTreeData(treeStructure);

        // Collapse all groups by default
        setExpandedGroups(new Set());

      } catch (error) {
        console.error('Error fetching lines data:', error);
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
              <span className="expand-icon">
                {isGroupExpanded(group.id) ? '📂' : '📁'}
              </span>
              <span className="group-icon">🧮</span>
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
                    <span className="line-icon">🔗</span>
                    <span className="line-name">{line.name}</span>
                    <span className="line-debug" style={{color: '#666', fontSize: '10px', marginLeft: '5px'}}>
                      (ID: {line.id})
                    </span>
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