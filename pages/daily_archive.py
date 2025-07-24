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
)
from pages.page_elements.graph_elements import get_period_graph
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS

# Import callbacks
from pages.callbacks import (
    update_daily_table,
    update_daily_pinned_row,
    update_daily_width_table,
    download_daily_xlsx,
    update_daily_graph
)

dash.register_page(__name__, path="/")


def layout(**kwargs):
    daily_data = pd.DataFrame(columns=[column["field"] for column in HOUR_DATE_COLUMNS])
    return dbc.Container(
        [
            dbc.Row(
                [
                    # Левая колонка с таблицами вычислителей и линий
                    dbc.Col(
                        [
                            # Таблица вычислителей
                            html.H6(
                                "Вычислители",
                                id="gas_calcs_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("gas_calcs_table", get_gas_calcs()),
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
                                id="lines_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("lines_table", get_lines_for_gas_calc()),
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
                                "Суточный архив",
                                className="text-center text-white mb-3",
                                id="daily_table_label",
                            ),
                            get_data_table("daily_data_table", HOUR_DATE_COLUMNS),
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
                                            id="download_daily_xlsx",
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
            # Dropdown для выбора колонки графика
            dcc.Dropdown(
                id="daily_graph_dropbox",
                options=[
                    {"label": column["headerName"], "value": column["field"]}
                    for column in HOUR_DATE_COLUMNS
                    if column["field"] != "period"
                ],
                value="volume",
                style={"backgroundColor": "#3e3e3e"},
                className="mt-3",
            ),
            # График
            dbc.Row(
                [
                    dbc.Col(
                        dcc.Graph(
                            figure=get_period_graph(daily_data, "volume", "Объем, м3"),
                            id="daily_graph",
                            className="mt-3",
                        ),
                    ),
                ]
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
