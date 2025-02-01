import dash_bootstrap_components as dbc
import dash
import dash_ag_grid as dag
import pandas as pd
from dash import html, Input, Output, State, callback, Patch
from dash.exceptions import PreventUpdate

from assets.styles import (
    VALUE_FORMATTER,
    TABLE_STYLE,
    TABLE_CLASS_NAME,
    DEFAULT_COL_DEF,
)
from pages.data_porcess.data_proc import get_list_of_points, get_daily_data

# Register Dash page
dash.register_page(__name__, path="/")

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
]  # Only period & volume for multi-selections

# Fetch initial data
list_data = get_list_of_points()
data = pd.DataFrame()

# Create AgGrid tables
list_of_gas_volume_calcs = dag.AgGrid(
    id="gas_volumes_table",
    rowData=list_data.to_dict("records"),
    columnDefs=[dict(field="name", headerName="Узел учета", checkboxSelection=True)],
    style=TABLE_STYLE,
    className=TABLE_CLASS_NAME,
    defaultColDef=DEFAULT_COL_DEF,
    dashGridOptions={"rowSelection": "multiple", "suppressRowClickSelection": True},
)

data_table = dag.AgGrid(
    id="data_table",
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
                width="auto",
                style={"display": "flex", "flexDirection": "column"},
            ),
            dbc.Col(
                [
                    html.H6(
                        "Суточный архив, ГРС-1", className="text-center text-white mb-3"
                    ),
                    data_table,
                ],
                width="auto",
                style={
                    "overflowY": "auto",
                    "display": "flex",
                    "flexDirection": "column",
                    "flex": 1,
                },
            ),
        ],
        className="mt-3",
        justify="start",
    )


@callback(
    Output("data_table", "rowData"),
    Output("data_table", "columnDefs"),
    Input("gas_volumes_table", "cellClicked"),
    Input("gas_volumes_table", "selectedRows"),
    Input("selected_dates", "data"),
    State("gas_volumes_table", "virtualRowData"),
)
def update_table(active_cell, selected_rows, date_data, data_list):
    """Update table data based on user selection."""
    if not (selected_rows or active_cell):
        raise PreventUpdate

    params = extract_params(selected_rows, active_cell, data_list, date_data)
    new_data = get_daily_data(**params)

    row_data = process_new_data(new_data)
    column_defs = (
        SUMMARY_COLUMNS if len(params["gas_volume_calc_id"]) > 1 else BASE_COLUMNS
    )

    return row_data, column_defs


def extract_params(selected_rows, active_cell, data_list, date_data):
    """Extract parameters for fetching data based on user selection."""
    params = {}

    if selected_rows:
        params["gas_volume_calc_id"] = [row["id"] for row in selected_rows]
    elif active_cell:
        params["gas_volume_calc_id"] = [data_list[active_cell["rowIndex"]]["id"]]

    if date_data.get("date_check"):
        params["from_date"], params["to_date"] = (
            date_data["from_date"],
            date_data["to_date"],
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
    Output("data_table", "dashGridOptions"),
    Input("data_table", "virtualRowData"),
)
def update_pinned_row(data_df):
    """Update pinned bottom row with summary values."""
    df = pd.DataFrame(data_df)

    if df.empty:
        means = {"pressure": 0, "temperature": 0, "density": 0}
    else:
        means = df.agg(
            {
                "volume": "sum",
                "w_volume_dp": "mean",
                "pressure": "mean",
                "temperature": "mean",
                "density": "mean",
            }
        ).round(3)

    patch = Patch()
    patch["pinnedBottomRowData"] = [{**means}]
    return patch
