from datetime import datetime

import dash_bootstrap_components as dbc
import dash
import dash_ag_grid as dag
import pandas as pd
from dash import html, Input, Output, State, callback, Patch
from dash.exceptions import PreventUpdate

from api.daily_archive_client import DailyArchiveClient
from api.gas_volume_calc_client import GasVolumeCalcClient
from api.hourly_archive_client import HourlyArchiveClient
from api.line_client import LineClient
from assets.styles import (
    VALUE_FORMATTER,
    TABLE_STYLE,
    TABLE_CLASS_NAME,
    DEFAULT_COL_DEF,
)
from pages.data_porcess.data_proc import get_list_of_points, get_daily_data

# Register Dash page
dash.register_page(__name__, path="/hour")

# Define column definitions
BASE_COLUMNS = [
    dict(field="period", headerName="Дата"),
    dict(field="volume", headerName="Объем с.у., м3", valueFormatter=VALUE_FORMATTER),
    dict(
        field="w_volume_dp",
        headerName="Перепад/Рабочий объем, м3",
        valueFormatter=VALUE_FORMATTER,
    ),
    dict(
        field="pressure", headerName="Давление, кг/см2", valueFormatter=VALUE_FORMATTER
    ),
    dict(
        field="temperature", headerName="Температура, С", valueFormatter=VALUE_FORMATTER
    ),
    dict(
        field="density", headerName="Плотность, кг/м3", valueFormatter=VALUE_FORMATTER
    ),
]

SUMMARY_COLUMNS = [
    BASE_COLUMNS[0],
    BASE_COLUMNS[1],
]

list_data = LineClient().get_lines_list_by_lumg()
gas_volume_data = GasVolumeCalcClient().get_gas_volume_list_by_lumg()
merge_data = list_data.merge(
    gas_volume_data.rename(columns={"name": "name_gas_volume", "id": "flow_id"})[
        ["flow_id", "name_gas_volume", "address"]
    ],
    left_on="gas_volume_calc_id",
    right_on="flow_id",
    how="left",
).sort_values(["address", "line"], ascending=[False, True])

data = pd.DataFrame()

list_of_gas_volume_calcs = dag.AgGrid(
    id="gas_volumes_table",
    rowData=merge_data.to_dict("records"),
    columnDefs=[
        dict(field="name_gas_volume", headerName="Узел учета"),
        dict(field="name", headerName="Линия", checkboxSelection=True),
    ],
    columnSize="autoSize",
    style=TABLE_STYLE,
    className=TABLE_CLASS_NAME,
    defaultColDef=DEFAULT_COL_DEF,
    dashGridOptions={
        "rowSelection": "multiple",
        "suppressRowClickSelection": True,
    },
)

data_table = dag.AgGrid(
    id="hour_data_table",
    rowData=data.to_dict("records"),
    columnDefs=BASE_COLUMNS,
    style=TABLE_STYLE,
    className=TABLE_CLASS_NAME,
    defaultColDef=DEFAULT_COL_DEF,
    dashGridOptions={},
)


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
                    list_of_gas_volume_calcs,
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
                    data_table,
                ],
                width=8,
            ),
        ],
        className="mt-3",
        justify="start",
    )


@callback(
    Output("hour_data_table", "rowData"),
    Output("hour_data_table", "columnDefs"),
    Input("gas_volumes_table", "cellClicked"),
    Input("gas_volumes_table", "selectedRows"),
    Input("selected_dates", "data"),
    State("gas_volumes_table", "virtualRowData"),
)
def update_hour_table(active_cell, selected_rows, date_data, data_list):
    """Update table data based on user selection."""
    if not (selected_rows or active_cell):
        raise PreventUpdate

    params = extract_params(selected_rows, active_cell, data_list, date_data)
    new_data = HourlyArchiveClient().get_hourly_archives(**params)

    row_data = process_new_data(new_data)
    column_defs = SUMMARY_COLUMNS if len(params["line_id"]) > 1 else BASE_COLUMNS

    return row_data, column_defs


def extract_params(selected_rows, active_cell, data_list, date_data):
    """Extract parameters for fetching data based on user selection."""
    params = {}
    if selected_rows:
        params["line_id"] = [row["id"] for row in selected_rows]
    elif active_cell:
        params["line_id"] = [data_list[active_cell["rowIndex"]]["id"]]

    if date_data.get("date_check"):
        params["from_date"], params["to_date"] = (
            datetime.strptime(date_data["from_date"], "%Y-%m-%d").replace(
                hour=date_data["start_hour"]
            ),
            datetime.strptime(date_data["to_date"], "%Y-%m-%d").replace(
                hour=date_data["end_hour"]
            ),
        )

    return params


def process_new_data(new_data):
    """Process data and return formatted records."""
    if new_data.empty:
        return pd.DataFrame().to_dict("records")

    return (
        new_data.groupby("period")
        .sum(numeric_only=True)
        .reset_index()
        .to_dict("records")
    )


@callback(
    Output("hour_data_table", "dashGridOptions"),
    Input("hour_data_table", "virtualRowData"),
)
def hour_update_pinned_row(data_df):
    """Update pinned bottom row with summary values."""
    df = pd.DataFrame(data_df)

    if df.empty:
        aggregated_values = {
            "volume": 0,
            "w_volume_dp": 0,
            "pressure": 0,
            "temperature": 0,
            "density": 0,
        }
    else:
        aggregated_values = df.agg(
            {
                "volume": "sum",
                "w_volume_dp": "mean",
                "pressure": "mean",
                "temperature": "mean",
                "density": "mean",
            }
        ).round(3)

    patch = Patch()
    patch["pinnedBottomRowData"] = [{**aggregated_values}]
    return patch
