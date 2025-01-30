import dash_bootstrap_components as dbc
import dash
import dash_ag_grid as dag
import pandas as pd
from dash import html, dash_table, Input, Output, State, callback, Patch
from dash.exceptions import PreventUpdate

from assets.styles import TABLE_STYLE, HEADER_STYLE, CELL_STYLE
from pages.data_porcess.data_proc import get_list_of_points, get_daily_data

dash.register_page(__name__, path="/")

list_columns = [dict(id="name", name="Узел учета")]
list_data = get_list_of_points()

columns = [
    dict(field="period", headerName="Дата"),
    dict(
        field="volume",
        headerName="Объем с.у., м3",
    ),
    dict(
        field="w_volume_dp",
        headerName="Перепад/Рабочий объем, м3",
    ),
    dict(
        field="pressure",
        headerName="Давление, кг/см2",
    ),
    dict(
        field="temperature",
        headerName="Температура, С",
    ),
    dict(
        field="density",
        headerName="Плотность, кг/м3",
    ),
]

data = get_daily_data(gas_volume_calc_id=1)

list_of_gas_volume_calcs = dash_table.DataTable(
    id="list_table",
    columns=list_columns,
    data=list_data,
    fixed_rows={"headers": True},
    style_table=TABLE_STYLE,
    style_header=HEADER_STYLE,
    style_cell=CELL_STYLE,
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
    Input("list_table", "active_cell"),
    Input("selected_dates", "data"),
    State("list_table", "data"),
)
def point_list_click(active_cell, date_data, data_list):
    if active_cell:
        date_dicts = date_data
        row = active_cell["row"]
        params = {"gas_volume_calc_id": data_list[row]["id"]}
        if date_dicts["date_check"]:
            params["from_date"] = date_dicts["from_date"]
            params["to_date"] = date_dicts["to_date"]
        new_data = get_daily_data(**params).to_dict("records")
        if not new_data:
            new_data = pd.DataFrame()
        return new_data
    raise PreventUpdate


@callback(
    Output("table", "dashGridOptions"),
    Input("table", "virtualRowData"),
)
def row_pinning_bottom(data_df):
    dff = pd.DataFrame(data_df)
    means = (
        dff[["pressure", "temperature", "density"]].mean()
        if data_df
        else {"pressure": 0, "temperature": 0, "density": 0}
    )

    grid_option_patch = Patch()
    grid_option_patch["pinnedBottomRowData"] = [{**means}]
    return grid_option_patch
