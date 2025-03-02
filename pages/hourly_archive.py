import io

import dash_bootstrap_components as dbc
import dash
import pandas as pd
from dash import html, Input, Output, State, callback, Patch, dcc

from api.hourly_archive_client import HourlyArchiveClient
from assets.styles import BUTTON_STYLE_XLS, ICON_STYLE_XLS
from pages.data_porcess.data_proc import get_lines, update_table, update_pinned_row
from pages.page_elements.graph_elements import get_period_graph
from pages.page_elements.table_elements import (
    get_table_of_lines,
    get_data_table,
    HOUR_DATE_COLUMNS,
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
                    dbc.Col(
                        [
                            html.H6(
                                "Список узлов учета",
                                id="hourly_gas_volume_calc_header",
                                className="text-center text-white mb-3",
                            ),
                            get_table_of_lines("hourly_gas_volumes", get_lines()),
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
                                "Часовой архив", className="text-center text-white mb-3"
                            ),
                            get_data_table("hourly_data_table", HOUR_DATE_COLUMNS),
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
                            id="hourly_xls",
                            style=BUTTON_STYLE_XLS,
                            className="btn-custom",
                            title="Экспорт в excel",
                        ),
                        dcc.Download(id="hourly_xlsx_download"),
                    ],
                    width=12,
                    className="d-flex justify-content-end",
                ),
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
        ],
        fluid=True,
    )


@callback(
    Output("hourly_data_table", "rowData"),
    Output("hourly_data_table", "columnDefs"),
    Output("hourly_graph", "figure"),
    Input("hourly_gas_volumes", "cellClicked"),
    Input("hourly_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    Input("hourly_graph_dropbox", "value"),
    Input("hourly_graph_dropbox", "label"),
    State("hourly_gas_volumes", "virtualRowData"),
)
def update_hour_table(
    active_cell, selected_rows, date_data, drop_value, drop_label, data_list
):
    ctx = dash.callback_context
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    selected_gas_volume = False
    if button_id == "hourly_gas_volumes":
        selected_gas_volume = True
    row_data, column_defs = update_table(
        active_cell,
        selected_rows,
        HourlyArchiveClient,
        date_data,
        data_list,
        selected_gas_volume,
    )
    label = [
        column["headerName"]
        for column in HOUR_DATE_COLUMNS
        if column["field"] == drop_value
    ][0]

    fig = get_period_graph(df=pd.DataFrame(row_data), y_axis=drop_value, y_label=label)
    return row_data, column_defs, fig


@callback(
    Output("hourly_data_table", "columnSize"),
    Input("hourly_data_table", "rowData"),
)
def update_width_table(_):
    column_size = "autoSize"
    return column_size


@callback(
    Output("hourly_data_table", "dashGridOptions"),
    Input("hourly_data_table", "virtualRowData"),
)
def hour_update_pinned_row(data_df):
    return update_pinned_row(data_df)


@callback(
    Output("hourly_xlsx_download", "data"),
    Input("hourly_xls", "n_clicks"),
    State("hourly_data_table", "rowData"),
    State("hourly_gas_volumes", "selectedRows"),
    prevent_initial_call=True,
)
def download_hourly_xlsx(n_clicks, data, selected_rows):
    output = io.BytesIO()
    df_hourly = pd.DataFrame(data)
    lines = None
    if selected_rows:
        lines = [row["id"] for row in selected_rows]
    if lines and len(lines) == 1:
        line = lines[0]
    else:
        line = ""
    from_date = df_hourly.period.min()
    to_date = df_hourly.period.max()
    df_hourly.to_excel(output)  # TODO ExcelWriter?
    return dcc.send_bytes(output.getvalue(), f"hourly{line}_{from_date}_{to_date}.xlsx")
