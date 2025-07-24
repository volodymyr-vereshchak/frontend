import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_gas_calcs, get_lines_for_gas_calc
from pages.page_elements.table_elements import (
    get_table_of_gas_calcs,
    get_table_of_lines_for_gas_calc,
    get_data_table,
    HOUR_DATE_COLUMNS,
    EDIT_COLUMNS,
)
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS

# Import callbacks
from pages.callbacks import (
    update_edit_table,
    download_edit_xlsx
)

dash.register_page(__name__, path="/edit")


def layout(**kwargs):
    daily_data = pd.DataFrame(columns=[column["field"] for column in HOUR_DATE_COLUMNS])
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
                                id="edit_gas_calcs_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("edit_gas_calcs_table", get_gas_calcs()),
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
                                id="edit_lines_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("edit_lines_table", get_lines_for_gas_calc()),
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
                                "Архив вмешательств",
                                className="text-center text-white mb-3",
                                id="edit_table_label",
                            ),
                            get_data_table("edit_data_table", EDIT_COLUMNS),
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
                                            id="download_edit_xlsx",
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
