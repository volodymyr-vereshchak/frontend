"""Error display components for user feedback"""

import dash_bootstrap_components as dbc
from dash import html


def get_error_alert(error_message: str, error_type: str = "danger") -> dbc.Alert:
    """Create an error alert component"""
    return dbc.Alert(
        [
            html.I(className="fas fa-exclamation-triangle me-2"),
            html.Strong("Ошибка: "),
            error_message,
        ],
        color=error_type,
        dismissable=True,
        is_open=True,
        className="mb-3",
    )


def get_warning_alert(warning_message: str) -> dbc.Alert:
    """Create a warning alert component"""
    return dbc.Alert(
        [
            html.I(className="fas fa-exclamation-circle me-2"),
            html.Strong("Предупреждение: "),
            warning_message,
        ],
        color="warning",
        dismissable=True,
        is_open=True,
        className="mb-3",
    )


def get_success_alert(success_message: str) -> dbc.Alert:
    """Create a success alert component"""
    return dbc.Alert(
        [
            html.I(className="fas fa-check-circle me-2"),
            html.Strong("Успешно: "),
            success_message,
        ],
        color="success",
        dismissable=True,
        is_open=True,
        className="mb-3",
    )


def get_loading_spinner(message: str = "Загрузка данных...") -> dbc.Spinner:
    """Create a loading spinner component"""
    return dbc.Spinner(
        html.Div(message),
        color="primary",
        type="border",
        size="sm",
        className="mb-3",
    )


def get_no_data_message(message: str = "Данные не найдены") -> dbc.Alert:
    """Create a no data message component"""
    return dbc.Alert(
        [
            html.I(className="fas fa-info-circle me-2"),
            message,
        ],
        color="info",
        className="mb-3",
    ) 