"""
Accordion callbacks for accordion view selection.

This module contains all callbacks related to accordion view selection
with improved error handling and logging.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import dash
from dash import Input, Output, State, callback, ALL, MATCH, html
from dash.exceptions import PreventUpdate

logger = logging.getLogger(__name__)


def _get_triggered_component() -> str:
    """Get the ID of the component that triggered the callback."""
    ctx = dash.callback_context
    if not ctx.triggered:
        return ""
    return ctx.triggered[0]["prop_id"].split(".")[0]


@callback(
    Output({"type": "accordion-item", "index": MATCH}, "style"),
    Output({"type": "accordion-item", "index": MATCH}, "n_clicks"),
    Input({"type": "accordion-item", "index": MATCH}, "n_clicks"),
    State({"type": "accordion-item", "index": MATCH}, "id"),
    prevent_initial_call=True,
)
def toggle_accordion_item_selection(n_clicks, item_id):
    """Toggle selection state of an accordion item."""
    if not n_clicks:
        raise PreventUpdate
    
    # Get the item index from the ID
    item_index = item_id["index"]
    
    # Toggle selection style
    if n_clicks % 2 == 1:  # Odd clicks = selected
        style = {
            "backgroundColor": "#4caf50",
            "border": "1px solid #4caf50",
            "color": "#ffffff",
            "fontWeight": "bold",
            "cursor": "pointer",
            "padding": "8px 12px",
            "transition": "all 0.2s ease"
        }
    else:  # Even clicks = deselected
        style = {
            "backgroundColor": "#1a1a1a",
            "border": "1px solid #2a2a2a",
            "color": "#9e9e9e",
            "fontWeight": "normal",
            "cursor": "pointer",
            "padding": "8px 12px",
            "transition": "all 0.2s ease"
        }
    
    return style, n_clicks


# Callbacks for updating data tables based on accordion selection
@callback(
    Output("hourly_data_table", "rowData"),
    Output("hourly_data_table", "columnDefs"),
    Input({"type": "accordion-item", "index": ALL}, "n_clicks"),
    State({"type": "accordion-item", "index": ALL}, "id"),
    Input("selected_dates", "data"),
    prevent_initial_call=True,
)
def update_hourly_table_from_accordion(n_clicks_list, item_ids, date_data):
    """Update hourly table based on accordion selection."""
    if not any(n_clicks_list):
        raise PreventUpdate
    
    # Get selected items
    selected_items = []
    for i, n_clicks in enumerate(n_clicks_list):
        if n_clicks and n_clicks % 2 == 1:  # Selected items
            selected_items.append(item_ids[i]["index"])
    
    if not selected_items:
        return [], []
    
    # Get data for selected items
    from pages.data_porcess.data_proc import get_lines
    from api.hourly_archive_client import HourlyArchiveClient
    from pages.page_elements.table_elements import HOUR_DATE_COLUMNS, SUMMARY_HOUR_DATE_COLUMNS
    
    data_list = get_lines()
    selected_data = [item for item in data_list.to_dict("records") if item["id"] in selected_items]
    
    if not selected_data:
        return [], HOUR_DATE_COLUMNS
    
    # Create params for API call
    params = {"line_id": selected_items}
    
    if date_data and date_data.get("date_check"):
        from datetime import datetime
        params["from_date"] = datetime.strptime(date_data["from_date"], "%Y-%m-%d").replace(
            hour=date_data["start_hour"]
        )
        params["to_date"] = datetime.strptime(date_data["to_date"], "%Y-%m-%d").replace(
            hour=date_data["end_hour"]
        )
    
    # Get data from API
    try:
        new_data = HourlyArchiveClient().get_archives(**params)
        if not new_data.empty:
            new_data = new_data.groupby("period").sum(numeric_only=True).fillna(0).reset_index()
            new_data = new_data.rename(columns={"index": "period"}).to_dict("records")
        else:
            new_data = []
        
        column_defs = SUMMARY_HOUR_DATE_COLUMNS if len(selected_items) > 1 else HOUR_DATE_COLUMNS
        return new_data, column_defs
        
    except Exception as e:
        logger.error(f"Error updating hourly table from accordion: {e}")
        return [], HOUR_DATE_COLUMNS


@callback(
    Output("daily_data_table", "rowData"),
    Output("daily_data_table", "columnDefs"),
    Input({"type": "accordion-item", "index": ALL}, "n_clicks"),
    State({"type": "accordion-item", "index": ALL}, "id"),
    Input("selected_dates", "data"),
    prevent_initial_call=True,
)
def update_daily_table_from_accordion(n_clicks_list, item_ids, date_data):
    """Update daily table based on accordion selection."""
    if not any(n_clicks_list):
        raise PreventUpdate
    
    # Get selected items
    selected_items = []
    for i, n_clicks in enumerate(n_clicks_list):
        if n_clicks and n_clicks % 2 == 1:  # Selected items
            selected_items.append(item_ids[i]["index"])
    
    if not selected_items:
        return [], []
    
    # Get data for selected items
    from pages.data_porcess.data_proc import get_lines
    from api.daily_archive_client import DailyArchiveClient
    from pages.page_elements.table_elements import HOUR_DATE_COLUMNS, SUMMARY_HOUR_DATE_COLUMNS
    
    data_list = get_lines()
    selected_data = [item for item in data_list.to_dict("records") if item["id"] in selected_items]
    
    if not selected_data:
        return [], HOUR_DATE_COLUMNS
    
    # Create params for API call
    params = {"line_id": selected_items}
    
    if date_data and date_data.get("date_check"):
        params["from_date"] = date_data["from_date"]
        params["to_date"] = date_data["to_date"]
    
    # Get data from API
    try:
        new_data = DailyArchiveClient().get_archives(**params)
        if not new_data.empty:
            new_data = new_data.groupby("period").sum(numeric_only=True).fillna(0).reset_index()
            new_data = new_data.rename(columns={"index": "period"}).to_dict("records")
        else:
            new_data = []
        
        column_defs = SUMMARY_HOUR_DATE_COLUMNS if len(selected_items) > 1 else HOUR_DATE_COLUMNS
        return new_data, column_defs
        
    except Exception as e:
        logger.error(f"Error updating daily table from accordion: {e}")
        return [], HOUR_DATE_COLUMNS


@callback(
    Output("sys_data_table", "rowData"),
    Input({"type": "accordion-item", "index": ALL}, "n_clicks"),
    State({"type": "accordion-item", "index": ALL}, "id"),
    Input("selected_dates", "data"),
    prevent_initial_call=True,
)
def update_sys_table_from_accordion(n_clicks_list, item_ids, date_data):
    """Update sys table based on accordion selection."""
    if not any(n_clicks_list):
        raise PreventUpdate
    
    # Get selected items
    selected_items = []
    for i, n_clicks in enumerate(n_clicks_list):
        if n_clicks and n_clicks % 2 == 1:  # Selected items
            selected_items.append(item_ids[i]["index"])
    
    if not selected_items:
        return []
    
    # Get data for selected items
    from pages.data_porcess.data_proc import get_lines
    from api.sys_archive_client import SysArchiveClient
    
    data_list = get_lines()
    selected_data = [item for item in data_list.to_dict("records") if item["id"] in selected_items]
    
    if not selected_data:
        return []
    
    # Create params for API call
    params = {"line_id": selected_items}
    
    if date_data and date_data.get("date_check"):
        from datetime import datetime
        params["from_date"] = datetime.strptime(date_data["from_date"], "%Y-%m-%d").replace(
            hour=date_data["start_hour"]
        )
        params["to_date"] = datetime.strptime(date_data["to_date"], "%Y-%m-%d").replace(
            hour=date_data["end_hour"]
        )
    
    # Get data from API
    try:
        new_data = SysArchiveClient().get_archives(**params)
        return new_data.to_dict("records") if not new_data.empty else []
        
    except Exception as e:
        logger.error(f"Error updating sys table from accordion: {e}")
        return []


@callback(
    Output("edit_data_table", "rowData"),
    Input({"type": "accordion-item", "index": ALL}, "n_clicks"),
    State({"type": "accordion-item", "index": ALL}, "id"),
    Input("selected_dates", "data"),
    prevent_initial_call=True,
)
def update_edit_table_from_accordion(n_clicks_list, item_ids, date_data):
    """Update edit table based on accordion selection."""
    if not any(n_clicks_list):
        raise PreventUpdate
    
    # Get selected items
    selected_items = []
    for i, n_clicks in enumerate(n_clicks_list):
        if n_clicks and n_clicks % 2 == 1:  # Selected items
            selected_items.append(item_ids[i]["index"])
    
    if not selected_items:
        return []
    
    # Get data for selected items
    from pages.data_porcess.data_proc import get_lines
    from api.edit_archive_client import EditArchiveClient
    
    data_list = get_lines()
    selected_data = [item for item in data_list.to_dict("records") if item["id"] in selected_items]
    
    if not selected_data:
        return []
    
    # Create params for API call
    params = {"line_id": selected_items}
    
    if date_data and date_data.get("date_check"):
        from datetime import datetime
        params["from_date"] = datetime.strptime(date_data["from_date"], "%Y-%m-%d").replace(
            hour=date_data["start_hour"]
        )
        params["to_date"] = datetime.strptime(date_data["to_date"], "%Y-%m-%d").replace(
            hour=date_data["end_hour"]
        )
    
    # Get data from API
    try:
        new_data = EditArchiveClient().get_archives(**params)
        if not new_data.empty:
            new_data["old_value"] = new_data.apply(
                lambda r: convert_int_to_hex_to_float(r.old_value), axis=1
            )
            new_data["new_value"] = new_data.apply(
                lambda r: convert_int_to_hex_to_float(r.new_value), axis=1
            )
        return new_data.to_dict("records") if not new_data.empty else []
        
    except Exception as e:
        logger.error(f"Error updating edit table from accordion: {e}")
        return []


@callback(
    Output("param_data_table", "rowData"),
    Input({"type": "accordion-item", "index": ALL}, "n_clicks"),
    State({"type": "accordion-item", "index": ALL}, "id"),
    Input("selected_dates", "data"),
    prevent_initial_call=True,
)
def update_param_table_from_accordion(n_clicks_list, item_ids, date_data):
    """Update param table based on accordion selection."""
    if not any(n_clicks_list):
        raise PreventUpdate
    
    # Get selected items
    selected_items = []
    for i, n_clicks in enumerate(n_clicks_list):
        if n_clicks and n_clicks % 2 == 1:  # Selected items
            selected_items.append(item_ids[i]["index"])
    
    if not selected_items:
        return []
    
    # Get data for selected items
    from pages.data_porcess.data_proc import get_lines
    from api.param_client import ParamClient
    
    data_list = get_lines()
    selected_data = [item for item in data_list.to_dict("records") if item["id"] in selected_items]
    
    if not selected_data:
        return []
    
    # Create params for API call
    params = {"line_id": selected_items[0]}  # Param client expects single line_id
    
    # Get data from API
    try:
        new_data = ParamClient().get_params(**params)
        return new_data.to_dict("records") if not new_data.empty else []
        
    except Exception as e:
        logger.error(f"Error updating param table from accordion: {e}")
        return []


# Helper function for converting values
def convert_int_to_hex_to_float(value):
    """Convert integer to hex to float for edit values."""
    try:
        if pd.isna(value):
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            if value.startswith('0x'):
                return float(int(value, 16))
            else:
                return float(value)
        return 0.0
    except:
        return 0.0 