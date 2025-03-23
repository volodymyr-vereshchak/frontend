import io

import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, Input, Output, State, callback, dcc

from api.param_client import ParamClient
from assets.styles import ICON_STYLE_XLS, BUTTON_STYLE_XLS
from pages.data_porcess.data_proc import get_lines, update_table_sys
from pages.page_elements.param_page.param_table import (
    PARAM_COLUMNS,
    RENAME_PARAMS_COLUMNS,
)
from pages.page_elements.table_elements import (
    get_table_of_lines,
    get_data_table,
)

dash.register_page(__name__, path="/param")


def layout(**kwargs):
    return dbc.Container(
        [
            dbc.Row(
                [
                    dbc.Col(
                        [
                            html.H6(
                                "Список узлов учета",
                                id="param_gas_volume_calc_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines(
                                "param_gas_volumes", get_lines(), multiple=False
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
                                "Параметры",
                                className="text-center text-white mb-3",
                                id="param_table_label",
                            ),
                            get_data_table("param_data_table", PARAM_COLUMNS),
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
                            id="param_xls",
                            style=BUTTON_STYLE_XLS,
                            className="btn-custom",
                            title="Экспорт в excel",
                        ),
                        dcc.Download(id="param_xlsx_download"),
                    ],
                    width=12,
                    className="d-flex justify-content-end",
                ),
            ),
        ],
        fluid=True,
    )


@callback(
    Output("param_data_table", "rowData"),
    Input("param_gas_volumes", "cellClicked"),
    Input("param_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("param_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_param_table(active_cell, selected_row, date_data, data_list):
    ctx = dash.callback_context
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    selected_gas_volume = False
    if button_id == "param_gas_volumes":
        selected_gas_volume = True
    row_data = update_table_sys(
        active_cell,
        selected_row,
        ParamClient,
        date_data,
        data_list,
        selected_gas_volume,
    )
    row_data = row_data.drop(columns=["period"]).rename(columns=RENAME_PARAMS_COLUMNS)
    row_data = row_data.T.reset_index().rename(columns={"index": "name", 0: "value"})
    return row_data.to_dict("records")


@callback(
    Output("param_data_table", "columnSize"),
    Input("param_data_table", "rowData"),
)
def update_width_table(_):
    column_size = "autoSize"
    return column_size


@callback(
    Output("param_xlsx_download", "data"),
    Input("param_xls", "n_clicks"),
    State("param_data_table", "rowData"),
    State("param_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_param_xlsx(n_clicks, data, selected_rows):
    output = io.BytesIO()
    df_param = pd.DataFrame(data)
    if selected_rows:
        line = selected_rows[0]["id"]
    else:
        line = ""
    from_date = df_param.period.min()
    to_date = df_param.period.max()
    df_param.to_excel(output)  # TODO ExcelWriter?
    return dcc.send_bytes(output.getvalue(), f"param{line}_{from_date}_{to_date}.xlsx")
