import io

import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, Input, Output, State, callback, dcc

from api.edit_archive_client import EditArchiveClient
from api.sys_archive_client import SysArchiveClient
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS
from pages.data_porcess.data_proc import get_lines, update_table_edit, update_table_sys
from pages.page_elements.table_elements import (
    get_table_of_lines,
    get_data_table,
    HOUR_DATE_COLUMNS,
    EDIT_COLUMNS,
    SYS_COLUMNS,
)

dash.register_page(__name__, path="/sys")


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


@callback(
    Output("sys_data_table", "rowData"),
    Input("sys_gas_volumes", "cellClicked"),
    Input("sys_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("sys_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_edit_table(active_cell, selected_row, date_data, data_list):
    ctx = dash.callback_context
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    selected_gas_volume = False
    if button_id == "sys_gas_volumes":
        selected_gas_volume = True
    row_data = update_table_sys(
        active_cell,
        selected_row,
        SysArchiveClient,
        date_data,
        data_list,
        selected_gas_volume,
    )
    return row_data.to_dict("records")


@callback(
    Output("sys_data_table", "columnSize"),
    Input("sys_data_table", "rowData"),
)
def update_width_table(_):
    column_size = "autoSize"
    return column_size


@callback(
    Output("sys_xlsx_download", "data"),
    Input("sys_xls", "n_clicks"),
    State("sys_data_table", "rowData"),
    State("sys_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_sys_xlsx(n_clicks, data, selected_rows):
    output = io.BytesIO()
    df_sys = pd.DataFrame(data)
    if selected_rows:
        line = selected_rows[0]["id"]
    else:
        line = ""
    from_date = df_sys.period.min()
    to_date = df_sys.period.max()
    df_sys.to_excel(output)  # TODO ExcelWriter?
    return dcc.send_bytes(output.getvalue(), f"sys{line}_{from_date}_{to_date}.xlsx")
