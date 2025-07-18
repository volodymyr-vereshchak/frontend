"""
Table callbacks for data table updates.

This module contains all callbacks related to updating data tables
with improved error handling and logging.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import dash
from dash import Input, Output, State, callback
from dash.exceptions import PreventUpdate

from api.daily_archive_client import DailyArchiveClient
from api.hourly_archive_client import HourlyArchiveClient
from api.sys_archive_client import SysArchiveClient
from api.param_client import ParamClient
from api.edit_archive_client import EditArchiveClient
from pages.data_porcess.data_proc import update_table, update_table_sys, update_table_edit, update_pinned_row
from pages.page_elements.table_elements import HOUR_DATE_COLUMNS, SUMMARY_HOUR_DATE_COLUMNS
from pages.page_elements.param_page.param_table import RENAME_PARAMS_COLUMNS
from pages.page_elements.error_elements import get_error_alert
from utils.validators import validate_date_data, validate_selection_data

logger = logging.getLogger(__name__)


def _get_triggered_component() -> str:
    """Get the ID of the component that triggered the callback."""
    ctx = dash.callback_context
    if not ctx.triggered:
        return ""
    return ctx.triggered[0]["prop_id"].split(".")[0]


def _validate_table_inputs(
    active_cell: Optional[Dict], 
    selected_rows: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> bool:
    """Validate inputs for table update callbacks."""
    try:
        # Check if we have any selection
        if not (selected_rows or active_cell):
            logger.debug("No selection made, preventing update")
            return False
            
        # Validate date data
        if date_data and not validate_date_data(date_data):
            logger.warning("Invalid date data received")
            return False
            
        # Validate selection data
        if not validate_selection_data(selected_rows, active_cell):
            logger.warning("Invalid selection data received")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error validating table inputs: {e}")
        return False


@callback(
    Output("daily_data_table", "rowData"),
    Output("daily_data_table", "columnDefs"),
    Input("daily_gas_volumes", "cellClicked"),
    Input("daily_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("daily_gas_volumes", "virtualRowData"),
)
def update_daily_table(
    active_cell: Optional[Dict], 
    selected_rows: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> Tuple[List[Dict], List[Dict]]:
    """Update daily archive table with data."""
    try:
        if not _validate_table_inputs(active_cell, selected_rows, date_data, data_list):
            raise PreventUpdate
            
        button_id = _get_triggered_component()
        selected_gas_volume = button_id == "daily_gas_volumes"
        
        logger.info(f"Updating daily table with {len(selected_rows or [])} selected rows")
        
        row_data, column_defs = update_table(
            active_cell,
            selected_rows,
            DailyArchiveClient,
            date_data,
            data_list,
            selected_gas_volume,
        )
        
        logger.debug(f"Daily table updated with {len(row_data)} rows")
        return row_data, column_defs
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error updating daily table: {e}")
        return [], HOUR_DATE_COLUMNS


@callback(
    Output("hourly_data_table", "rowData"),
    Output("hourly_data_table", "columnDefs"),
    Input("hourly_gas_volumes", "cellClicked"),
    Input("hourly_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("hourly_gas_volumes", "virtualRowData"),
)
def update_hourly_table(
    active_cell: Optional[Dict], 
    selected_rows: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> Tuple[List[Dict], List[Dict]]:
    """Update hourly archive table with data."""
    try:
        if not _validate_table_inputs(active_cell, selected_rows, date_data, data_list):
            raise PreventUpdate
            
        button_id = _get_triggered_component()
        selected_gas_volume = button_id == "hourly_gas_volumes"
        
        logger.info(f"Updating hourly table with {len(selected_rows or [])} selected rows")
        
        row_data, column_defs = update_table(
            active_cell,
            selected_rows,
            HourlyArchiveClient,
            date_data,
            data_list,
            selected_gas_volume,
        )
        
        logger.debug(f"Hourly table updated with {len(row_data)} rows")
        return row_data, column_defs
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error updating hourly table: {e}")
        return [], HOUR_DATE_COLUMNS


@callback(
    Output("sys_data_table", "rowData"),
    Input("sys_gas_volumes", "cellClicked"),
    Input("sys_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("sys_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_sys_table(
    active_cell: Optional[Dict], 
    selected_row: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> List[Dict]:
    """Update system archive table with data."""
    try:
        if not _validate_table_inputs(active_cell, selected_row, date_data, data_list):
            raise PreventUpdate
            
        button_id = _get_triggered_component()
        selected_gas_volume = button_id == "sys_gas_volumes"
        
        logger.info(f"Updating sys table with {len(selected_row or [])} selected rows")
        
        row_data = update_table_sys(
            active_cell,
            selected_row,
            SysArchiveClient,
            date_data,
            data_list,
            selected_gas_volume,
        )
        
        logger.debug(f"Sys table updated with {len(row_data)} rows")
        return row_data.to_dict("records")
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error updating sys table: {e}")
        return []


@callback(
    Output("param_data_table", "rowData"),
    Input("param_gas_volumes", "cellClicked"),
    Input("param_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("param_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_param_table(
    active_cell: Optional[Dict], 
    selected_row: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> List[Dict]:
    """Update parameters table with data."""
    try:
        if not _validate_table_inputs(active_cell, selected_row, date_data, data_list):
            raise PreventUpdate
            
        button_id = _get_triggered_component()
        selected_gas_volume = button_id == "param_gas_volumes"
        
        logger.info(f"Updating param table with {len(selected_row or [])} selected rows")
        
        row_data = update_table_sys(
            active_cell,
            selected_row,
            ParamClient,
            date_data,
            data_list,
            selected_gas_volume,
        )
        
        # Transform data for parameters table
        row_data = row_data.drop(columns=["period"]).rename(columns=RENAME_PARAMS_COLUMNS)
        row_data = row_data.T.reset_index().rename(columns={"index": "name", 0: "value"})
        
        logger.debug(f"Param table updated with {len(row_data)} rows")
        return row_data.to_dict("records")
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error updating param table: {e}")
        return []


@callback(
    Output("edit_data_table", "rowData"),
    Input("edit_gas_volumes", "cellClicked"),
    Input("edit_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("edit_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_edit_table(
    active_cell: Optional[Dict], 
    selected_row: Optional[List], 
    date_data: Optional[Dict],
    data_list: Optional[List]
) -> List[Dict]:
    """Update edit archive table with data."""
    try:
        if not _validate_table_inputs(active_cell, selected_row, date_data, data_list):
            raise PreventUpdate
            
        button_id = _get_triggered_component()
        selected_gas_volume = button_id == "edit_gas_volumes"
        
        logger.info(f"Updating edit table with {len(selected_row or [])} selected rows")
        
        row_data = update_table_edit(
            active_cell,
            selected_row,
            EditArchiveClient,
            date_data,
            data_list,
            selected_gas_volume,
        )
        
        logger.debug(f"Edit table updated with {len(row_data)} rows")
        return row_data.to_dict("records")
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error updating edit table: {e}")
        return []


@callback(
    Output("daily_data_table", "dashGridOptions"),
    Input("daily_data_table", "virtualRowData"),
)
def update_daily_pinned_row(data_df: List[Dict]) -> Dict[str, Any]:
    """Update pinned row for daily data table."""
    try:
        return update_pinned_row(data_df)
    except Exception as e:
        logger.error(f"Error updating daily pinned row: {e}")
        return {}


@callback(
    Output("hourly_data_table", "dashGridOptions"),
    Input("hourly_data_table", "virtualRowData"),
)
def update_hourly_pinned_row(data_df: List[Dict]) -> Dict[str, Any]:
    """Update pinned row for hourly data table."""
    try:
        return update_pinned_row(data_df)
    except Exception as e:
        logger.error(f"Error updating hourly pinned row: {e}")
        return {}


@callback(
    Output("daily_data_table", "columnSize"),
    Input("daily_data_table", "rowData"),
)
def update_daily_width_table(_: List[Dict]) -> str:
    """Update column size for daily data table."""
    return "autoSize"


@callback(
    Output("hourly_data_table", "columnSize"),
    Input("hourly_data_table", "rowData"),
)
def update_hourly_width_table(_: List[Dict]) -> str:
    """Update column size for hourly data table."""
    return "autoSize"


@callback(
    Output("sys_data_table", "columnSize"),
    Input("sys_data_table", "rowData"),
)
def update_sys_width_table(_: List[Dict]) -> str:
    """Update column size for sys data table."""
    return "autoSize" 