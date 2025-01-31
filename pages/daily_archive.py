import json

import dash_bootstrap_components as dbc
import dash
import dash_ag_grid as dag
import pandas as pd
from dash import html, dash_table, Input, Output, State, callback, Patch
from dash.exceptions import PreventUpdate

from assets.styles import TABLE_STYLE, HEADER_STYLE, CELL_STYLE
from pages.data_porcess.data_proc import get_list_of_points, get_daily_data

dash.register_page(__name__, path="/")

list_columns = [dict(field="name", headerName="Узел учета", checkboxSelection=True)]
list_data = get_list_of_points()

locale_numbers = """d3.formatLocale({
  "decimal": ",",
  "thousands": "\u00a0",
  "grouping": [3],
})"""

value_formatter = {"function": f"{locale_numbers}.format('$,.3f')(params.value)"}

columns = [
    dict(field="period", headerName="Дата"),
    dict(
        field="volume",
        headerName="Объем с.у., м3",
        valueFormatter=value_formatter,
    ),
    dict(
        field="w_volume_dp",
        headerName="Перепад/Рабочий объем, м3",
        valueFormatter=value_formatter,
    ),
    dict(
        field="pressure",
        headerName="Давление, кг/см2",
        valueFormatter=value_formatter,
    ),
    dict(
        field="temperature",
        headerName="Температура, С",
        valueFormatter=value_formatter,
    ),
    dict(
        field="density",
        headerName="Плотность, кг/м3",
        valueFormatter=value_formatter,
    ),
]

data = get_daily_data(gas_volume_calc_id=1)

list_of_gas_volume_calcs = dag.AgGrid(
    id="gas_volumes_table",
    rowData=list_data.to_dict("records"),
    columnDefs=list_columns,
    style={"height": "70vh"},
    className="ag-theme-alpine-dark",
    defaultColDef={
        "cellRendererSelector": {"function": "rowPinningBottom(params)"},
    },
    dashGridOptions={"rowSelection": "multiple", "suppressRowClickSelection": True},
)


data_table = dag.AgGrid(
    id="table",
    rowData=data.to_dict("records"),
    columnDefs=columns,
    style={"height": "70vh"},
    className="ag-theme-alpine-dark",
    defaultColDef={
        "cellRendererSelector": {"function": "rowPinningBottom(params)"},
    },
    dashGridOptions={},
)


def layout(**kwargs):
    return (
        dbc.Row(
            [
                dbc.Col(
                    [
                        html.H6(
                            "Список узлов учета",  # Заголовок списка
                            id="gas_volume_calc_header",
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        list_of_gas_volume_calcs,
                    ],
                    width="auto",
                    style={
                        # "overflowY": "auto",
                        "display": "flex",
                        "flexDirection": "column",
                    },
                ),
                # Right column: DataTable
                dbc.Col(
                    [
                        html.H6(
                            "Суточный архив, ГРС-1",  # Заголовок списка
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        data_table,
                    ],
                    width="auto",
                    style={
                        "overflowY": "auto",
                        "display": "flex",
                        "flexDirection": "column",
                        # "maxWidth": "1200px",
                        "flex": 1,
                    },
                ),
            ],
            className="mt-3",
            justify="start",
        ),
    )


@callback(
    Output("table", "rowData"),
    Input("gas_volumes_table", "cellClicked"),
    Input("selected_dates", "data"),
    State("gas_volumes_table", "virtualRowData"),
)
def point_list_click(active_cell, date_data, data_list):
    if active_cell:
        date_dicts = date_data
        params = {"gas_volume_calc_id": data_list[active_cell["rowIndex"]]["id"]}
        if date_dicts["date_check"]:
            params["from_date"] = date_dicts["from_date"]
            params["to_date"] = date_dicts["to_date"]
        new_data = get_daily_data(**params).to_dict("records")
        if not new_data:
            new_data = pd.DataFrame().to_dict("records")
        return new_data
    raise PreventUpdate


@callback(
    Output("table", "dashGridOptions"),
    Input("table", "virtualRowData"),
)
def row_pinning_bottom(data_df):
    df = pd.DataFrame(data_df)
    means = (
        df.agg(
            {
                "volume": "sum",
                "w_volume_dp": "mean",
                "pressure": "mean",
                "temperature": "mean",
                "density": "mean",
            }
        ).round(3)
        if data_df
        else {"pressure": 0, "temperature": 0, "density": 0}
    )

    grid_option_patch = Patch()
    grid_option_patch["pinnedBottomRowData"] = [{**means}]
    return grid_option_patch
