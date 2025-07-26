"""
Line persistence callbacks for saving and restoring selected line across pages.

This module contains callbacks for:
- Saving selected line to session storage
- Restoring selected line when switching pages
- Maintaining selection state across navigation
"""

import dash
from dash import Input, Output, State
from dash.exceptions import PreventUpdate
import logging

logger = logging.getLogger(__name__)


def save_daily_selected_line():
    """Save selected line to session storage for daily page"""
    @dash.callback(
        Output("selected_line_store", "data", allow_duplicate=True),
        Input("lines_table", "selectedRows"),
        State("selected_line_store", "data"),
        prevent_initial_call=True
    )
    def _save_daily_selected_line(daily_selected, current_data):
        logger.info(f"save_daily_selected_line called with: {daily_selected}")
        if daily_selected and len(daily_selected) > 0:
            selected_line = daily_selected[0]
            logger.info(f"Saving daily selected line: {selected_line}")
            return selected_line
        logger.debug("No daily line selected, keeping current data")
        return current_data


def save_hourly_selected_line():
    """Save selected line to session storage for hourly page"""
    @dash.callback(
        Output("selected_line_store", "data", allow_duplicate=True),
        Input("hourly_lines_table", "selectedRows"),
        State("selected_line_store", "data"),
        prevent_initial_call=True
    )
    def _save_hourly_selected_line(hourly_selected, current_data):
        logger.info(f"save_hourly_selected_line called with: {hourly_selected}")
        if hourly_selected and len(hourly_selected) > 0:
            selected_line = hourly_selected[0]
            logger.info(f"Saving hourly selected line: {selected_line}")
            return selected_line
        logger.debug("No hourly line selected, keeping current data")
        return current_data


def save_sys_selected_line():
    """Save selected line to session storage for sys page"""
    @dash.callback(
        Output("selected_line_store", "data", allow_duplicate=True),
        Input("sys_lines_table", "selectedRows"),
        State("selected_line_store", "data"),
        prevent_initial_call=True
    )
    def _save_sys_selected_line(sys_selected, current_data):
        logger.info(f"save_sys_selected_line called with: {sys_selected}")
        if sys_selected and len(sys_selected) > 0:
            selected_line = sys_selected[0]
            logger.info(f"Saving sys selected line: {selected_line}")
            return selected_line
        logger.debug("No sys line selected, keeping current data")
        return current_data


def save_edit_selected_line():
    """Save selected line to session storage for edit page"""
    @dash.callback(
        Output("selected_line_store", "data", allow_duplicate=True),
        Input("edit_lines_table", "selectedRows"),
        State("selected_line_store", "data"),
        prevent_initial_call=True
    )
    def _save_edit_selected_line(edit_selected, current_data):
        logger.info(f"save_edit_selected_line called with: {edit_selected}")
        if edit_selected and len(edit_selected) > 0:
            selected_line = edit_selected[0]
            logger.info(f"Saving edit selected line: {selected_line}")
            return selected_line
        logger.debug("No edit line selected, keeping current data")
        return current_data


def save_param_selected_line():
    """Save selected line to session storage for param page"""
    @dash.callback(
        Output("selected_line_store", "data", allow_duplicate=True),
        Input("param_lines_table", "selectedRows"),
        State("selected_line_store", "data"),
        prevent_initial_call=True
    )
    def _save_param_selected_line(param_selected, current_data):
        logger.info(f"save_param_selected_line called with: {param_selected}")
        if param_selected and len(param_selected) > 0:
            selected_line = param_selected[0]
            logger.info(f"Saving param selected line: {selected_line}")
            return selected_line
        logger.debug("No param line selected, keeping current data")
        return current_data


def restore_selected_line():
    """Restore selected line from session storage"""
    @dash.callback(
        Output("lines_table", "selectedRows", allow_duplicate=True),
        Input("selected_line_store", "data"),
        Input("lines_table", "rowData"),
        prevent_initial_call=True
    )
    def _restore_selected_line_daily(stored_line, daily_data):
        if not stored_line or not daily_data:
            return []
        
        # Helper function to find line object
        def find_line_object(data, line_id):
            if not data:
                return None
            for row in data:
                if row.get('id') == line_id:
                    return row
            return None
        
        line_id = stored_line.get('id')
        if line_id:
            line_object = find_line_object(daily_data, line_id)
            if line_object:
                logger.info(f"Restoring line {line_id} in daily table")
                return [line_object]
        
        return []


def restore_hourly_selected_line():
    """Restore selected line from session storage for hourly page"""
    @dash.callback(
        Output("hourly_lines_table", "selectedRows", allow_duplicate=True),
        Input("selected_line_store", "data"),
        Input("hourly_lines_table", "rowData"),
        prevent_initial_call=True
    )
    def _restore_selected_line_hourly(stored_line, hourly_data):
        if not stored_line or not hourly_data:
            return []
        
        # Helper function to find line object
        def find_line_object(data, line_id):
            if not data:
                return None
            for row in data:
                if row.get('id') == line_id:
                    return row
            return None
        
        line_id = stored_line.get('id')
        if line_id:
            line_object = find_line_object(hourly_data, line_id)
            if line_object:
                logger.info(f"Restoring line {line_id} in hourly table")
                return [line_object]
        
        return []


def restore_sys_selected_line():
    """Restore selected line from session storage for sys page"""
    @dash.callback(
        Output("sys_lines_table", "selectedRows", allow_duplicate=True),
        Input("selected_line_store", "data"),
        Input("sys_lines_table", "rowData"),
        prevent_initial_call=True
    )
    def _restore_selected_line_sys(stored_line, sys_data):
        if not stored_line or not sys_data:
            return []
        
        # Helper function to find line object
        def find_line_object(data, line_id):
            if not data:
                return None
            for row in data:
                if row.get('id') == line_id:
                    return row
            return None
        
        line_id = stored_line.get('id')
        if line_id:
            line_object = find_line_object(sys_data, line_id)
            if line_object:
                logger.info(f"Restoring line {line_id} in sys table")
                return [line_object]
        
        return []


def restore_edit_selected_line():
    """Restore selected line from session storage for edit page"""
    @dash.callback(
        Output("edit_lines_table", "selectedRows", allow_duplicate=True),
        Input("selected_line_store", "data"),
        Input("edit_lines_table", "rowData"),
        prevent_initial_call=True
    )
    def _restore_selected_line_edit(stored_line, edit_data):
        if not stored_line or not edit_data:
            return []
        
        # Helper function to find line object
        def find_line_object(data, line_id):
            if not data:
                return None
            for row in data:
                if row.get('id') == line_id:
                    return row
            return None
        
        line_id = stored_line.get('id')
        if line_id:
            line_object = find_line_object(edit_data, line_id)
            if line_object:
                logger.info(f"Restoring line {line_id} in edit table")
                return [line_object]
        
        return []


def restore_param_selected_line():
    """Restore selected line from session storage for param page"""
    @dash.callback(
        Output("param_lines_table", "selectedRows", allow_duplicate=True),
        Input("selected_line_store", "data"),
        Input("param_lines_table", "rowData"),
        prevent_initial_call=True
    )
    def _restore_selected_line_param(stored_line, param_data):
        if not stored_line or not param_data:
            return []
        
        # Helper function to find line object
        def find_line_object(data, line_id):
            if not data:
                return None
            for row in data:
                if row.get('id') == line_id:
                    return row
            return None
        
        line_id = stored_line.get('id')
        if line_id:
            line_object = find_line_object(param_data, line_id)
            if line_object:
                logger.info(f"Restoring line {line_id} in param table")
                return [line_object]
        
        return []


# Register all callbacks
save_daily_selected_line()
save_hourly_selected_line()
save_sys_selected_line()
save_edit_selected_line()
save_param_selected_line()
restore_selected_line()
restore_hourly_selected_line()
restore_sys_selected_line()
restore_edit_selected_line()
restore_param_selected_line() 