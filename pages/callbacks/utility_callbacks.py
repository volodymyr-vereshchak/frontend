"""
Utility callbacks for UI interactions.

This module contains utility callbacks for navigation,
button states, and other UI interactions.
"""

import logging
from typing import Dict, Any, Optional
import dash
from dash import Input, Output, callback

logger = logging.getLogger(__name__)


@callback(
    Output("active-button", "data"),
    Input("days", "n_clicks"),
    Input("hours", "n_clicks"),
    Input("sys", "n_clicks"),
    Input("edits", "n_clicks"),
    Input("param", "n_clicks"),
)
def update_active_button(
    days_clicks: Optional[int],
    hours_clicks: Optional[int],
    sys_clicks: Optional[int],
    edits_clicks: Optional[int],
    param_clicks: Optional[int]
) -> str:
    """Update the active button state based on navigation."""
    try:
        ctx = dash.callback_context
        if not ctx.triggered:
            return "days"  # Default to daily archive
            
        button_id = ctx.triggered[0]["prop_id"].split(".")[0]
        
        # Map button IDs to page names
        button_map = {
            "days": "daily",
            "hours": "hourly", 
            "sys": "system",
            "edits": "edit",
            "param": "param"
        }
        
        active_page = button_map.get(button_id, "daily")
        logger.debug(f"Active button changed to: {active_page}")
        
        return active_page
        
    except Exception as e:
        logger.error(f"Error updating active button: {e}")
        return "daily" 