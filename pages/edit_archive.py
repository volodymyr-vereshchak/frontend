import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, dcc

from pages.data_porcess.data_proc import get_lines
from pages.page_elements.table_elements import (
    get_table_of_lines,
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
                    dbc.Col(
                        [
                            html.H6(
                                "Список узлов учета",
                                id="edit_gas_volume_calc_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines(
                                "edit_gas_volumes", get_lines(), multiple=False
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
                                "Архив вмешательств",
                                className="text-center text-white mb-3",
                                id="edit_table_label",
                            ),
                            get_data_table("edit_data_table", EDIT_COLUMNS),
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
                            id="edit_xls",
                            style=BUTTON_STYLE_XLS,
                            className="btn-custom",
                            title="Экспорт в excel",
                        ),
                        dcc.Download(id="edit_xlsx_download"),
                    ],
                    width=12,
                    className="d-flex justify-content-end",
                ),
            ),
        ],
        fluid=True,
    )


# Callbacks are now imported from pages.callbacks module
