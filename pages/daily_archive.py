import dash_bootstrap_components as dbc
import dash
from dash import html, Input, Output, State, callback

from api.daily_archive_client import DailyArchiveClient
from pages.data_porcess.data_proc import get_lines, update_table, update_pinned_row
from pages.page_elements.table_elements import (
    get_table_of_lines,
    get_data_table,
)

dash.register_page(__name__, path="/")


daily_list_of_gas_volume_calcs = get_table_of_lines("daily_gas_volumes", get_lines())

daily_data_table = get_data_table("daily_data_table")


def layout(**kwargs):
    return dbc.Row(
        [
            dbc.Col(
                [
                    html.H6(
                        "Список узлов учета",
                        id="gas_volume_calc_header",
                        className="text-center text-white mb-3",
                    ),
                    daily_list_of_gas_volume_calcs,
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
                    daily_data_table,
                ],
                width=8,
            ),
        ],
        className="mt-3",
        justify="start",
    )


@callback(
    Output("daily_data_table", "rowData"),
    Output("daily_data_table", "columnDefs"),
    Input("daily_gas_volumes", "cellClicked"),
    Input("daily_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("daily_gas_volumes", "virtualRowData"),
    # prevent_initial_call=True,
)
def update_daily_table(active_cell, selected_rows, date_data, data_list):
    ctx = dash.callback_context
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    selected_gas_volume = False
    if button_id == "daily_gas_volumes":
        selected_gas_volume = True
    row_data, column_defs = update_table(
        active_cell,
        selected_rows,
        DailyArchiveClient,
        date_data,
        data_list,
        selected_gas_volume,
    )
    return row_data, column_defs


@callback(
    Output("daily_data_table", "columnSize"),
    Input("daily_data_table", "rowData"),
)
def update_width_table(_):
    column_size = "autoSize"
    return column_size


@callback(
    Output("daily_data_table", "dashGridOptions"),
    Input("daily_data_table", "virtualRowData"),
)
def update_daily_pinned_row(data_df):
    return update_pinned_row(data_df)
