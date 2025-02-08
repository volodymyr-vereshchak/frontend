import dash_bootstrap_components as dbc
import dash
from dash import html, Input, Output, State, callback, Patch

from api.hourly_archive_client import HourlyArchiveClient
from pages.data_porcess.data_proc import get_lines, update_table, update_pinned_row
from pages.page_elements.table_elements import get_table_of_lines, get_data_table

# Register Dash page
dash.register_page(__name__, path="/hour")

hourly_list_of_gas_volume_calcs = get_table_of_lines("hourly_gas_volumes", get_lines())

hourly_data_table = get_data_table("hourly_data_table")


def layout(**kwargs):
    return dbc.Row(
        [
            dbc.Col(
                [
                    html.H6(
                        "Список узлов учета",
                        id="hourly_gas_volume_calc_header",
                        className="text-center text-white mb-3",
                    ),
                    hourly_list_of_gas_volume_calcs,
                ],
                width=4,
                style={
                    "display": "inline-block",
                    "verticalAlign": "top",
                },
            ),
            dbc.Col(
                [
                    html.H6("Часовой архив", className="text-center text-white mb-3"),
                    hourly_data_table,
                ],
                width=8,
            ),
        ],
        className="mt-3",
        justify="start",
    )


@callback(
    Output("hourly_data_table", "rowData"),
    Output("hourly_data_table", "columnDefs"),
    Input("hourly_gas_volumes", "cellClicked"),
    Input("hourly_gas_volumes", "selectedRows"),
    Input("selected_dates", "data"),
    State("hourly_gas_volumes", "virtualRowData"),
    prevent_initial_call=True,
)
def update_hour_table(active_cell, selected_rows, date_data, data_list):
    return update_table(
        active_cell, selected_rows, HourlyArchiveClient, date_data, data_list
    )


@callback(
    Output("hourly_data_table", "dashGridOptions"),
    Input("hourly_data_table", "virtualRowData"),
)
def hour_update_pinned_row(data_df):
    return update_pinned_row(data_df)
