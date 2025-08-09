"""
Report callbacks for displaying gas volume reports.

This module contains callbacks for the report functionality,
including fetching and displaying gas volume reports.
"""

import logging
from typing import Optional, Tuple, Any
import dash
from dash import Input, Output, State, callback
from dash.exceptions import PreventUpdate

from api.report_client import ReportClient
from pages.page_elements.report_elements import format_report_message

logger = logging.getLogger(__name__)


@callback(
    [
        Output("report_modal", "is_open"),
        Output("report_content", "children"),
    ],
    [
        Input("report_button", "n_clicks"),
        Input("refresh_report_button", "n_clicks"),
        Input("close_report_modal", "n_clicks"),
    ],
    [State("report_modal", "is_open")],
    prevent_initial_call=True,
)
def handle_report_modal(
    report_clicks: Optional[int],
    refresh_clicks: Optional[int], 
    close_clicks: Optional[int],
    is_open: bool
) -> Tuple[bool, Any]:
    """Handle report modal open/close and content updates."""
    try:
        ctx = dash.callback_context
        if not ctx.triggered:
            raise PreventUpdate
            
        button_id = ctx.triggered[0]["prop_id"].split(".")[0]
        
        # Закрытие модального окна
        if button_id == "close_report_modal":
            return False, "Нажмите кнопку 'Отчет ГРС' для получения данных"
        
        # Открытие модального окна или обновление отчета
        if button_id in ["report_button", "refresh_report_button"]:
            try:
                # Получаем отчет от API
                client = ReportClient()
                response = client.get_report()
                
                if response and isinstance(response, dict):
                    if response.get("success", False):
                        message = response.get("message", "")
                        formatted_content = format_report_message(message)
                        logger.info("Report generated successfully")
                        return True, formatted_content
                    else:
                        error_msg = response.get("message", "Неизвестная ошибка")
                        logger.error(f"Report generation failed: {error_msg}")
                        return True, format_report_message(f"Ошибка: {error_msg}")
                else:
                    logger.error("Invalid response from report API")
                    return True, format_report_message("Ошибка: Неверный ответ от сервера")
                    
            except Exception as e:
                logger.error(f"Error fetching report: {e}")
                return True, format_report_message(f"Ошибка при получении отчета: {str(e)}")
        
        # По умолчанию не изменяем состояние
        raise PreventUpdate
        
    except PreventUpdate:
        raise
    except Exception as e:
        logger.error(f"Error in report modal handler: {e}")
        return is_open, format_report_message(f"Произошла ошибка: {str(e)}")
