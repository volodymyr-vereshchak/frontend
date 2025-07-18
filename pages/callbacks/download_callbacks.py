"""
Download callbacks for file exports.

This module contains all callbacks related to file downloads
with improved error handling and validation.
"""

import logging
import io
from typing import Dict, List, Optional
import pandas as pd
from dash import Input, Output, State, callback, dcc
from dash.exceptions import PreventUpdate

from utils.validators import validate_download_data
from pages.page_elements.error_elements import get_error_alert

logger = logging.getLogger(__name__)


def _validate_download_inputs(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
) -> bool:
    """Validate inputs for download callbacks."""
    try:
        if not n_clicks:
            logger.debug("Download button not clicked")
            return False
            
        if not data:
            logger.warning("No data available for download")
            return False
            
        if not validate_download_data(data):
            logger.warning("Invalid data format for download")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error validating download inputs: {e}")
        return False


def _generate_filename(prefix: str, selected_rows: Optional[List[Dict]], data: List[Dict]) -> str:
    """Generate filename for download."""
    try:
        df = pd.DataFrame(data)
        
        # Get line identifier
        line = ""
        if selected_rows and len(selected_rows) == 1:
            line = f"_{selected_rows[0]['id']}"
        elif selected_rows and len(selected_rows) > 1:
            line = f"_{len(selected_rows)}_lines"
            
        # Get date range
        if 'period' in df.columns and not df.empty:
            from_date = df['period'].min()
            to_date = df['period'].max()
            date_range = f"_{from_date}_{to_date}"
        else:
            date_range = ""
            
        return f"{prefix}{line}{date_range}.xlsx"
        
    except Exception as e:
        logger.error(f"Error generating filename: {e}")
        return f"{prefix}_export.xlsx"


@callback(
    Output("daily_xlsx_download", "data"),
    Input("daily_xls", "n_clicks"),
    State("daily_data_table", "rowData"),
    State("daily_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_daily_xlsx(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
):
    """Download daily archive data as Excel file."""
    try:
        if not _validate_download_inputs(n_clicks, data, selected_rows):
            raise PreventUpdate
            
        logger.info("Starting daily archive download")
        
        output = io.BytesIO()
        df_daily = pd.DataFrame(data)
        
        # Generate filename
        filename = _generate_filename("daily", selected_rows, data)
        
        # Export to Excel
        df_daily.to_excel(output, index=False)
        
        logger.debug(f"Daily archive exported to {filename}")
        return dcc.send_bytes(output.getvalue(), filename)
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error downloading daily xlsx: {e}")
        return None


@callback(
    Output("hourly_xlsx_download", "data"),
    Input("hourly_xls", "n_clicks"),
    State("hourly_data_table", "rowData"),
    State("hourly_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_hourly_xlsx(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
):
    """Download hourly archive data as Excel file."""
    try:
        if not _validate_download_inputs(n_clicks, data, selected_rows):
            raise PreventUpdate
            
        logger.info("Starting hourly archive download")
        
        output = io.BytesIO()
        df_hourly = pd.DataFrame(data)
        
        # Generate filename
        filename = _generate_filename("hourly", selected_rows, data)
        
        # Export to Excel
        df_hourly.to_excel(output, index=False)
        
        logger.debug(f"Hourly archive exported to {filename}")
        return dcc.send_bytes(output.getvalue(), filename)
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error downloading hourly xlsx: {e}")
        return None


@callback(
    Output("sys_xlsx_download", "data"),
    Input("sys_xls", "n_clicks"),
    State("sys_data_table", "rowData"),
    State("sys_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_sys_xlsx(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
):
    """Download system archive data as Excel file."""
    try:
        if not _validate_download_inputs(n_clicks, data, selected_rows):
            raise PreventUpdate
            
        logger.info("Starting system archive download")
        
        output = io.BytesIO()
        df_sys = pd.DataFrame(data)
        
        # Generate filename
        filename = _generate_filename("sys", selected_rows, data)
        
        # Export to Excel
        df_sys.to_excel(output, index=False)
        
        logger.debug(f"System archive exported to {filename}")
        return dcc.send_bytes(output.getvalue(), filename)
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error downloading sys xlsx: {e}")
        return None


@callback(
    Output("param_xlsx_download", "data"),
    Input("param_xls", "n_clicks"),
    State("param_data_table", "rowData"),
    State("param_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_param_xlsx(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
):
    """Download parameters data as Excel file."""
    try:
        if not _validate_download_inputs(n_clicks, data, selected_rows):
            raise PreventUpdate
            
        logger.info("Starting parameters download")
        
        output = io.BytesIO()
        df_param = pd.DataFrame(data)
        
        # Generate filename
        filename = _generate_filename("param", selected_rows, data)
        
        # Export to Excel
        df_param.to_excel(output, index=False)
        
        logger.debug(f"Parameters exported to {filename}")
        return dcc.send_bytes(output.getvalue(), filename)
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error downloading param xlsx: {e}")
        return None


@callback(
    Output("edit_xlsx_download", "data"),
    Input("edit_xls", "n_clicks"),
    State("edit_data_table", "rowData"),
    State("edit_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_edit_xlsx(
    n_clicks: Optional[int], 
    data: Optional[List[Dict]], 
    selected_rows: Optional[List[Dict]]
):
    """Download edit archive data as Excel file."""
    try:
        if not _validate_download_inputs(n_clicks, data, selected_rows):
            raise PreventUpdate
            
        logger.info("Starting edit archive download")
        
        output = io.BytesIO()
        df_edit = pd.DataFrame(data)
        
        # Generate filename
        filename = _generate_filename("edit", selected_rows, data)
        
        # Export to Excel
        df_edit.to_excel(output, index=False)
        
        logger.debug(f"Edit archive exported to {filename}")
        return dcc.send_bytes(output.getvalue(), filename)
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error downloading edit xlsx: {e}")
        return None 