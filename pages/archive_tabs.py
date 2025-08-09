import dash_bootstrap_components as dbc
import dash
import pandas as pd
import io
import logging
from dash import html, dcc, Input, Output, State, callback
from dash.exceptions import PreventUpdate

from pages.data_porcess.data_proc import get_gas_calcs, get_lines_for_gas_calc
from pages.page_elements.table_elements import (
    get_table_of_gas_calcs,
    get_table_of_lines_for_gas_calc,
    get_data_table,
    HOUR_DATE_COLUMNS,
    SYS_COLUMNS,
)
from pages.page_elements.graph_elements import get_period_graph
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS

# Import callbacks - these are handled by the main callback modules
# from pages.callbacks import (
#     update_daily_table,
#     update_daily_pinned_row,
#     update_daily_width_table,
#     download_daily_xlsx,
#     update_daily_graph,
#     update_hourly_table,
#     update_hourly_pinned_row,
#     update_hourly_width_table,
#     download_hourly_xlsx,
#     update_hourly_graph,
#     update_sys_table,
#     update_sys_width_table,
#     download_sys_xlsx
# )

dash.register_page(__name__, path="/tabs")


def layout(**kwargs):
    daily_data = pd.DataFrame(columns=[column["field"] for column in HOUR_DATE_COLUMNS])
    hourly_data = pd.DataFrame(columns=[column["field"] for column in HOUR_DATE_COLUMNS])
    
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
                                id="gas_calcs_header_tabs",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("gas_calcs_table_tabs", get_gas_calcs()),
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
                                id="lines_header_tabs",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("lines_table_tabs", get_lines_for_gas_calc()),
                        ],
                        width="auto",
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                            "marginRight": "15px",
                        },
                    ),
                    # Правая колонка с табами для архивов
                    dbc.Col(
                        [
                            dbc.Tabs(
                                [
                                    dbc.Tab(
                                        [
                                            get_data_table("daily_data_table_tabs", HOUR_DATE_COLUMNS),
                                            # Кнопка выгрузки
                                            dbc.Row(
                                                [
                                                    dbc.Col(
                                                        dbc.Button(
                                                            html.Img(
                                                                src="assets/icons/excel.svg",
                                                                style=ICON_STYLE_XLS,
                                                            ),
                                                            id="download_daily_xlsx_tabs",
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
                                        label="Суточный архив",
                                        tab_id="daily-tab",
                                    ),
                                    dbc.Tab(
                                        [
                                            get_data_table("hourly_data_table_tabs", HOUR_DATE_COLUMNS),
                                            # Кнопка выгрузки
                                            dbc.Row(
                                                [
                                                    dbc.Col(
                                                        dbc.Button(
                                                            html.Img(
                                                                src="assets/icons/excel.svg",
                                                                style=ICON_STYLE_XLS,
                                                            ),
                                                            id="download_hourly_xlsx_tabs",
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
                                        label="Часовой архив",
                                        tab_id="hourly-tab",
                                    ),
                                    dbc.Tab(
                                        [
                                            get_data_table("sys_data_table_tabs", SYS_COLUMNS),
                                            # Кнопка выгрузки
                                            dbc.Row(
                                                [
                                                    dbc.Col(
                                                        dbc.Button(
                                                            html.Img(
                                                                src="assets/icons/excel.svg",
                                                                style=ICON_STYLE_XLS,
                                                            ),
                                                            id="download_sys_xlsx_tabs",
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
                                        label="Архив аварий",
                                        tab_id="sys-tab",
                                    ),
                                ],
                                id="archive-tabs",
                                active_tab="daily-tab",
                            ),
                        ],
                        width=True,
                    ),
                ]
            ),
            # Dropdown для выбора колонки графика
            dcc.Dropdown(
                id="graph_dropbox_tabs",
                options=[
                    {"label": column["headerName"], "value": column["field"]}
                    for column in HOUR_DATE_COLUMNS
                    if column["field"] != "period"
                ],
                value="volume",
                style={"backgroundColor": "#3e3e3e"},
                className="mt-3",
            ),
            # График на всю ширину экрана
            dbc.Row(
                [
                    dbc.Col(
                        dcc.Graph(
                            figure=get_period_graph(daily_data, "volume", "Объем, м3"),
                            id="archive_graph_tabs",
                            className="mt-3",
                        ),
                        width=12,
                    ),
                ]
            ),
            # Download components
            dcc.Download(id="daily_xlsx_download_tabs"),
            dcc.Download(id="hourly_xlsx_download_tabs"),
            dcc.Download(id="sys_xlsx_download_tabs"),
        ],
        fluid=True,
    )


# Note: Callbacks are handled by the main callback modules in pages/callbacks/
# This page uses the /tabs route and is an alternative layout with tabs
# The main functionality is provided by daily_archive.py and other individual archive pages
# To use this page with full functionality, additional callbacks would need to be implemented
# that handle the tab-specific behavior and unique element IDs used in this layout