import dash
import dash_bootstrap_components as dbc
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_lines
from pages.page_elements.table_elements import (
    get_table_of_lines,
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
                    dbc.Col(
                        [
                            html.H6(
                                "Список узлов учета",
                                id="sys_gas_volume_calc_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines(
                                "sys_gas_volumes", get_lines(), multiple=False
                            ),
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
                                "Архив аварий",
                                className="text-center text-white mb-3",
                                id="sys_table_label",
                            ),
                            get_data_table("sys_data_table", SYS_COLUMNS),
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
                            id="sys_xls",
                            style=BUTTON_STYLE_XLS,
                            className="btn-custom",
                            title="Экспорт в excel",
                        ),
                        dcc.Download(id="sys_xlsx_download"),
                    ],
                    width=12,
                    className="d-flex justify-content-end",
                ),
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
