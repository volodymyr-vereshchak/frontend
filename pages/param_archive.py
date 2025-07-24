import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_gas_calcs, get_lines_for_gas_calc
from pages.page_elements.param_page.param_table import (
    PARAM_COLUMNS,
    RENAME_PARAMS_COLUMNS,
)
from pages.page_elements.table_elements import (
    get_table_of_gas_calcs,
    get_table_of_lines_for_gas_calc,
    get_data_table,
)
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS

# Import callbacks
from pages.callbacks import (
    update_param_table,
    download_param_xlsx
)

dash.register_page(__name__, path="/param")


def layout(**kwargs):
    return dbc.Container(
        [
            dbc.Row(
                [
                    # Левая колонка с таблицей вычислителей
                    dbc.Col(
                        [
                            # Таблица вычислителей
                            html.H6(
                                "Вычислители",
                                id="param_gas_calcs_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("param_gas_calcs_table", get_gas_calcs()),
                        ],
                        width="auto",
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                            "marginRight": "20px",
                        },
                    ),
                    # Средняя колонка с таблицей линий
                    dbc.Col(
                        [
                            # Таблица линий для выбранного вычислителя
                            html.H6(
                                "Линии выбранного вычислителя",
                                id="param_lines_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("param_lines_table", get_lines_for_gas_calc()),
                        ],
                        width="auto",
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                            "marginRight": "20px",
                        },
                    ),
                    # Правая колонка с основной таблицей данных
                    dbc.Col(
                        [
                            html.H6(
                                "Параметры",
                                className="text-center text-white mb-3",
                                id="param_table_label",
                            ),
                            get_data_table("param_data_table", PARAM_COLUMNS),
                            dbc.Row(
                                [
                                    dbc.Col(
                                        dbc.Button(
                                            [
                                                html.Img(
                                                    src="assets/icons/excel.svg",
                                                    style=ICON_STYLE_XLS,
                                                ),
                                                " Скачать XLSX",
                                            ],
                                            id="download_param_xlsx",
                                            style=BUTTON_STYLE_XLS,
                                            color="success",
                                        ),
                                        width="auto",
                                    ),
                                ],
                                className="mt-3",
                            ),
                        ],
                        width=True,
                    ),
                ]
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
