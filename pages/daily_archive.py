import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_lines
from pages.page_elements.table_elements import (
    get_table_of_lines,
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
                    dbc.Col(
                        [
                            html.H6(
                                "Список узлов учета",
                                id="gas_volume_calc_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines("daily_gas_volumes", get_lines()),
                        ],
                        width=4,
                        style={
                            "display": "inline-block",
                            "verticalAlign": "top",
                        },
                    ),
                    dbc.Col(
                        [
                            html.H6(
                                "Суточный архив",
                                className="text-center text-white mb-3",
                                id="daily_table_label",
                            ),
                            get_data_table("daily_data_table", HOUR_DATE_COLUMNS),
                        ],
                        width=8,
                    ),
                ],
                className="mt-3",
                justify="start",
            ),
            dbc.Row(
                dbc.Col(
                    [
                        dbc.Button(
                            html.Img(
                                src="assets/icons/excel.svg", style=ICON_STYLE_XLS
                            ),
                            id="daily_xls",
                            style=BUTTON_STYLE_XLS,
                            className="btn-custom",
                            title="Экспорт в excel",
                        ),
                        dcc.Download(id="daily_xlsx_download"),
                    ],
                    width=12,
                    className="d-flex justify-content-end",
                ),
            ),
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
            dcc.Graph(
                figure=get_period_graph(
                    df=daily_data, y_axis="volume", y_label="Объем с.у., м3"
                ),
                id="daily_graph",
                className="mt-3",
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
