"""
Table selection callbacks for handling gas calculator and line selection.

This module contains callbacks for:
- Updating line table when gas calculator is selected
- Managing selection state between gas calculators and lines
"""

import dash
from dash import Input, Output, State, callback_context
from dash.exceptions import PreventUpdate
import pandas as pd
import logging

from pages.data_porcess.data_proc import get_lines_for_gas_calc

logger = logging.getLogger(__name__)


def update_lines_table_for_gas_calc():
    """Update lines table when gas calculator is selected for daily page"""
    @dash.callback(
        Output("lines_table", "rowData"),
        Output("lines_table", "selectedRows"),
        Input("gas_calcs_table", "selectedRows"),
        Input("gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_lines_table(selected_rows, row_data):
        logger.info(f"Daily: selected_rows={selected_rows}, row_data length={len(row_data) if row_data else 0}")
        
        if not selected_rows or not row_data:
            return [], []
        
        # Get selected gas calculator ID
        # selected_rows содержит объекты строк, берем первый
        selected_gas_calc = selected_rows[0]
        logger.info(f"Daily: selected_gas_calc={selected_gas_calc}")
        
        gas_calc_id = selected_gas_calc.get('id')  # Используем 'id' из API данных
        logger.info(f"Daily: gas_calc_id={gas_calc_id}")
        
        # Get lines for selected gas calculator
        lines_data = get_lines_for_gas_calc(gas_calc_id)
        logger.info(f"Daily: lines_data shape={lines_data.shape if not lines_data.empty else 'empty'}")
        
        return lines_data.to_dict("records"), []


def update_hourly_lines_table_for_gas_calc():
    """Update lines table when gas calculator is selected for hourly page"""
    @dash.callback(
        Output("hourly_lines_table", "rowData"),
        Output("hourly_lines_table", "selectedRows"),
        Input("hourly_gas_calcs_table", "selectedRows"),
        Input("hourly_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_lines_table(selected_rows, row_data):
        logger.info(f"Hourly: selected_rows={selected_rows}, row_data length={len(row_data) if row_data else 0}")
        
        if not selected_rows or not row_data:
            return [], []
        
        # Get selected gas calculator ID
        # selected_rows содержит объекты строк, берем первый
        selected_gas_calc = selected_rows[0]
        logger.info(f"Hourly: selected_gas_calc={selected_gas_calc}")
        
        gas_calc_id = selected_gas_calc.get('id')  # Используем 'id' из API данных
        logger.info(f"Hourly: gas_calc_id={gas_calc_id}")
        
        # Get lines for selected gas calculator
        lines_data = get_lines_for_gas_calc(gas_calc_id)
        logger.info(f"Hourly: lines_data shape={lines_data.shape if not lines_data.empty else 'empty'}")
        
        return lines_data.to_dict("records"), []


def update_sys_lines_table_for_gas_calc():
    """Update lines table when gas calculator is selected for sys page"""
    @dash.callback(
        Output("sys_lines_table", "rowData"),
        Output("sys_lines_table", "selectedRows"),
        Input("sys_gas_calcs_table", "selectedRows"),
        Input("sys_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_lines_table(selected_rows, row_data):
        logger.info(f"Sys: selected_rows={selected_rows}, row_data length={len(row_data) if row_data else 0}")
        
        if not selected_rows or not row_data:
            return [], []
        
        # Get selected gas calculator ID
        selected_gas_calc = selected_rows[0]
        logger.info(f"Sys: selected_gas_calc={selected_gas_calc}")
        
        gas_calc_id = selected_gas_calc.get('id')  # Используем 'id' из API данных
        logger.info(f"Sys: gas_calc_id={gas_calc_id}")
        
        # Get lines for selected gas calculator
        lines_data = get_lines_for_gas_calc(gas_calc_id)
        logger.info(f"Sys: lines_data shape={lines_data.shape if not lines_data.empty else 'empty'}")
        
        return lines_data.to_dict("records"), []


def update_edit_lines_table_for_gas_calc():
    """Update lines table when gas calculator is selected for edit page"""
    @dash.callback(
        Output("edit_lines_table", "rowData"),
        Output("edit_lines_table", "selectedRows"),
        Input("edit_gas_calcs_table", "selectedRows"),
        Input("edit_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_lines_table(selected_rows, row_data):
        logger.info(f"Edit: selected_rows={selected_rows}, row_data length={len(row_data) if row_data else 0}")
        
        if not selected_rows or not row_data:
            return [], []
        
        # Get selected gas calculator ID
        selected_gas_calc = selected_rows[0]
        logger.info(f"Edit: selected_gas_calc={selected_gas_calc}")
        
        gas_calc_id = selected_gas_calc.get('id')  # Используем 'id' из API данных
        logger.info(f"Edit: gas_calc_id={gas_calc_id}")
        
        # Get lines for selected gas calculator
        lines_data = get_lines_for_gas_calc(gas_calc_id)
        logger.info(f"Edit: lines_data shape={lines_data.shape if not lines_data.empty else 'empty'}")
        
        return lines_data.to_dict("records"), []


def update_param_lines_table_for_gas_calc():
    """Update lines table when gas calculator is selected for param page"""
    @dash.callback(
        Output("param_lines_table", "rowData"),
        Output("param_lines_table", "selectedRows"),
        Input("param_gas_calcs_table", "selectedRows"),
        Input("param_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_lines_table(selected_rows, row_data):
        logger.info(f"Param: selected_rows={selected_rows}, row_data length={len(row_data) if row_data else 0}")
        
        if not selected_rows or not row_data:
            return [], []
        
        # Get selected gas calculator ID
        selected_gas_calc = selected_rows[0]
        logger.info(f"Param: selected_gas_calc={selected_gas_calc}")
        
        gas_calc_id = selected_gas_calc.get('id')  # Используем 'id' из API данных
        logger.info(f"Param: gas_calc_id={gas_calc_id}")
        
        # Get lines for selected gas calculator
        lines_data = get_lines_for_gas_calc(gas_calc_id)
        logger.info(f"Param: lines_data shape={lines_data.shape if not lines_data.empty else 'empty'}")
        
        return lines_data.to_dict("records"), []


def update_gas_calcs_selection():
    """Update gas calculators table selection for daily page"""
    @dash.callback(
        Output("gas_calcs_table", "selectedRows"),
        Input("gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_gas_calcs_selection(row_data):
        logger.info(f"Daily gas calcs selection: row_data length={len(row_data) if row_data else 0}")
        
        if not row_data:
            return []
        
        # Select first gas calculator by default
        # Возвращаем индекс первой строки
        return [0]


def update_hourly_gas_calcs_selection():
    """Update gas calculators table selection for hourly page"""
    @dash.callback(
        Output("hourly_gas_calcs_table", "selectedRows"),
        Input("hourly_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_gas_calcs_selection(row_data):
        logger.info(f"Hourly gas calcs selection: row_data length={len(row_data) if row_data else 0}")
        
        if not row_data:
            return []
        
        # Select first gas calculator by default
        # Возвращаем индекс первой строки
        return [0]


def update_sys_gas_calcs_selection():
    """Update gas calculators table selection for sys page"""
    @dash.callback(
        Output("sys_gas_calcs_table", "selectedRows"),
        Input("sys_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_gas_calcs_selection(row_data):
        logger.info(f"Sys gas calcs selection: row_data length={len(row_data) if row_data else 0}")
        
        if not row_data:
            return []
        
        # Select first gas calculator by default
        return [0]


def update_edit_gas_calcs_selection():
    """Update gas calculators table selection for edit page"""
    @dash.callback(
        Output("edit_gas_calcs_table", "selectedRows"),
        Input("edit_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_gas_calcs_selection(row_data):
        logger.info(f"Edit gas calcs selection: row_data length={len(row_data) if row_data else 0}")
        
        if not row_data:
            return []
        
        # Select first gas calculator by default
        return [0]


def update_param_gas_calcs_selection():
    """Update gas calculators table selection for param page"""
    @dash.callback(
        Output("param_gas_calcs_table", "selectedRows"),
        Input("param_gas_calcs_table", "rowData"),
        prevent_initial_call=True
    )
    def _update_gas_calcs_selection(row_data):
        logger.info(f"Param gas calcs selection: row_data length={len(row_data) if row_data else 0}")
        
        if not row_data:
            return []
        
        # Select first gas calculator by default
        return [0]


# Register all callbacks
update_lines_table_for_gas_calc()
update_hourly_lines_table_for_gas_calc()
update_sys_lines_table_for_gas_calc()
update_edit_lines_table_for_gas_calc()
update_param_lines_table_for_gas_calc()
update_gas_calcs_selection()
update_hourly_gas_calcs_selection()
update_sys_gas_calcs_selection()
update_edit_gas_calcs_selection()
update_param_gas_calcs_selection() 