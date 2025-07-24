import dash
import dash_bootstrap_components as dbc
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_gas_calcs, get_lines_for_gas_calc
from pages.page_elements.table_elements import (
    get_table_of_gas_calcs,
    get_table_of_lines_for_gas_calc,
    get_data_table,
    SYS_COLUMNS,
)
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS

# Import callbacks
from pages.callbacks import (
    update_sys_table,
    update_sys_width_table,
    download_sys_xlsx
)

dash.register_page(__name__, path="/sys")


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
                                id="sys_gas_calcs_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("sys_gas_calcs_table", get_gas_calcs()),
                        ],
                        width="auto",
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                            "marginRight": "15px",
                        },
                    ),
                    # Средняя колонка с таблицей линий
                    dbc.Col(
                        [
                            # Таблица линий для выбранного вычислителя
                            html.H6(
                                "Линии выбранного вычислителя",
                                id="sys_lines_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("sys_lines_table", get_lines_for_gas_calc()),
                        ],
                        width="auto",
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                            "marginRight": "15px",
                        },
                    ),
                    # Правая колонка с основной таблицей данных
                    dbc.Col(
                        [
                            html.H6(
                                "Архив аварий",
                                className="text-center text-white mb-3",
                                id="sys_table_label",
                            ),
                            get_data_table("sys_data_table", SYS_COLUMNS),
                        ],
                        width=True,
                    ),
                ]
            ),
            # Кнопка выгрузки в отдельной строке в правом нижнем углу
            dbc.Row(
                [
                    dbc.Col(
                        dbc.Button(
                            html.Img(
                                src="assets/icons/excel.svg",
                                style=ICON_STYLE_XLS,
                            ),
                            id="download_sys_xlsx",
                            style=BUTTON_STYLE_XLS,
                            color="success",
                        ),
                        width="auto",
                    ),
                ],
                className="mt-3",
                justify="end",
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
