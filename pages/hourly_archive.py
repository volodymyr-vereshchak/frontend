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
from assets.styles import BUTTON_STYLE_XLS, ICON_STYLE_XLS

# Import callbacks
from pages.callbacks import (
    update_hourly_table,
    update_hourly_pinned_row,
    update_hourly_width_table,
    download_hourly_xlsx,
    update_hourly_graph
)

# Register Dash page
dash.register_page(__name__, path="/hour")


def layout(**kwargs):
    hourly_data = pd.DataFrame(
        columns=[column["field"] for column in HOUR_DATE_COLUMNS]
    )
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
                                id="hourly_gas_calcs_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_gas_calcs("hourly_gas_calcs_table", get_gas_calcs()),
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
                                id="hourly_lines_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines_for_gas_calc("hourly_lines_table", get_lines_for_gas_calc()),
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
                                "Часовой архив",
                                className="text-center text-white mb-3",
                                id="hourly_table_label",
                            ),
                            get_data_table("hourly_data_table", HOUR_DATE_COLUMNS),
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
                            id="download_hourly_xlsx",
                            style=BUTTON_STYLE_XLS,
                            color="success",
                        ),
                        width="auto",
                    ),
                ],
                className="mt-3",
                justify="end",
            ),
            dcc.Dropdown(
                id="hourly_graph_dropbox",
                options=[
                    {"label": column["headerName"], "value": column["field"]}
                    for column in HOUR_DATE_COLUMNS
                    if column["field"] != "period"
                ],
                value="volume",
                style={"backgroundColor": "#3e3e3e"},
                className="mt-3",
            ),
            dcc.Graph(
                figure=get_period_graph(
                    df=hourly_data, y_axis="volume", y_label="Объем с.у., м3"
                ),
                id="hourly_graph",
                className="mt-3",
            ),
            # Download component
            dcc.Download(id="hourly_xlsx_download"),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
