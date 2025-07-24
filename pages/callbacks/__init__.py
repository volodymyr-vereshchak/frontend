"""
Callbacks module for HLViewer application.

This module contains all callback functions organized by functionality:
- table_callbacks: Callbacks for data table updates
- download_callbacks: Callbacks for file downloads
- graph_callbacks: Callbacks for graph updates
- utility_callbacks: Utility callbacks for UI interactions
- table_selection_callbacks: Callbacks for gas calculator and line selection
"""

from .table_callbacks import *
from .download_callbacks import *
from .graph_callbacks import *
from .utility_callbacks import *
from .table_selection_callbacks import *

__all__ = [
    # Table callbacks
    'update_daily_table',
    'update_hourly_table', 
    'update_sys_table',
    'update_param_table',
    'update_edit_table',
    'update_pinned_row',
    'update_width_table',
    
    # Download callbacks
    'download_daily_xlsx',
    'download_hourly_xlsx',
    'download_sys_xlsx',
    'download_param_xlsx',
    'download_edit_xlsx',
    
    # Graph callbacks
    'update_daily_graph',
    'update_hourly_graph',
    
    # Utility callbacks
    'update_active_button',
    
    # Table selection callbacks
    'update_lines_table_for_gas_calc',
    'update_hourly_lines_table_for_gas_calc',
    'update_sys_lines_table_for_gas_calc',
    'update_edit_lines_table_for_gas_calc',
    'update_param_lines_table_for_gas_calc',
    'update_gas_calcs_selection',
    'update_hourly_gas_calcs_selection',
    'update_sys_gas_calcs_selection',
    'update_edit_gas_calcs_selection',
    'update_param_gas_calcs_selection',
] 