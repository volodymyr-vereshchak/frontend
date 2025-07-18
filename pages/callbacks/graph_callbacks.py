"""
Graph callbacks for chart updates.

This module contains all callbacks related to updating graphs
with improved error handling and validation.
"""

import logging
from typing import Dict, List, Optional, Any
import pandas as pd
import dash
from dash import Input, Output, State, callback
from dash.exceptions import PreventUpdate

from pages.page_elements.graph_elements import get_period_graph
from pages.page_elements.table_elements import HOUR_DATE_COLUMNS
from utils.validators import validate_graph_data

logger = logging.getLogger(__name__)


def _validate_graph_inputs(
    drop_value: Optional[str], 
    row_data: Optional[List[Dict]]
) -> bool:
    """Validate inputs for graph update callbacks."""
    try:
        if not drop_value:
            logger.debug("No graph column selected")
            return False
            
        if not row_data:
            logger.debug("No data available for graph")
            return False
            
        if not validate_graph_data(row_data, drop_value):
            logger.warning("Invalid data format for graph")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error validating graph inputs: {e}")
        return False


def _get_column_label(field: str) -> str:
    """Get the display label for a column field."""
    try:
        for column in HOUR_DATE_COLUMNS:
            if column["field"] == field:
                return column["headerName"]
        return field
    except Exception as e:
        logger.error(f"Error getting column label for {field}: {e}")
        return field


@callback(
    Output("daily_graph", "figure"),
    Input("daily_data_table", "rowData"),
    Input("daily_graph_dropbox", "value"),
)
def update_daily_graph(
    row_data: Optional[List[Dict]], 
    drop_value: Optional[str]
) -> Dict[str, Any]:
    """Update daily archive graph."""
    try:
        if not _validate_graph_inputs(drop_value, row_data):
            # Return empty graph
            return get_period_graph(
                df=pd.DataFrame(), 
                y_axis="volume", 
                y_label="Объем с.у., м3"
            )
            
        logger.info(f"Updating daily graph with column: {drop_value}")
        
        df = pd.DataFrame(row_data)
        label = _get_column_label(drop_value)
        
        fig = get_period_graph(df=df, y_axis=drop_value, y_label=label)
        
        logger.debug(f"Daily graph updated with {len(df)} data points")
        return fig
        
    except Exception as e:
        logger.error(f"Error updating daily graph: {e}")
        # Return empty graph on error
        return get_period_graph(
            df=pd.DataFrame(), 
            y_axis="volume", 
            y_label="Объем с.у., м3"
        )


@callback(
    Output("hourly_graph", "figure"),
    Input("hourly_data_table", "rowData"),
    Input("hourly_graph_dropbox", "value"),
)
def update_hourly_graph(
    row_data: Optional[List[Dict]], 
    drop_value: Optional[str]
) -> Dict[str, Any]:
    """Update hourly archive graph."""
    try:
        if not _validate_graph_inputs(drop_value, row_data):
            # Return empty graph
            return get_period_graph(
                df=pd.DataFrame(), 
                y_axis="volume", 
                y_label="Объем с.у., м3"
            )
            
        logger.info(f"Updating hourly graph with column: {drop_value}")
        
        df = pd.DataFrame(row_data)
        label = _get_column_label(drop_value)
        
        fig = get_period_graph(df=df, y_axis=drop_value, y_label=label)
        
        logger.debug(f"Hourly graph updated with {len(df)} data points")
        return fig
        
    except Exception as e:
        logger.error(f"Error updating hourly graph: {e}")
        # Return empty graph on error
        return get_period_graph(
            df=pd.DataFrame(), 
            y_axis="volume", 
            y_label="Объем с.у., м3"
        ) 