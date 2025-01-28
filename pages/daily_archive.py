import json

import dash_bootstrap_components as dbc
import dash
from dash import html, dash_table, Input, Output, State, callback
from dash.dash_table.Format import Format, Scheme
from dash.exceptions import PreventUpdate

from assets.styles import TABLE_STYLE, HEADER_STYLE, CELL_STYLE
from pages.data_porcess.data_proc import get_list_of_points, get_daily_data

dash.register_page(__name__, path="/")

list_columns = [dict(id="name", name="Узел учета")]
list_data = get_list_of_points()

columns = [
    dict(id="period", name="Дата"),
    dict(
        id="volume",
        name="Объем с.у., м3",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="w_volume_dp",
        name="Перепад/Рабочий объем, м3",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="pressure",
        name="Давление, кг/см2",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="temperature",
        name="Температура, С",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="density",
        name="Плотность, кг/м3",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
]

data = []

list_of_gas_volume_calcs = dash_table.DataTable(
    id="list_table",
    columns=list_columns,
    data=list_data,
    fixed_rows={"headers": True},
    style_table=TABLE_STYLE,
    style_header=HEADER_STYLE,
    style_cell=CELL_STYLE,
)

data_table = dash_table.DataTable(
    id="table",
    columns=columns,
    data=data,
    fixed_rows={"headers": True},
    style_table=TABLE_STYLE,
    style_header=HEADER_STYLE,
    style_cell=CELL_STYLE,
    style_data_conditional=[
        {
            "if": {
                "row_index": len(data) - 1,
            },
            "backgroundColor": "lightblue",
            "fontWeight": "bold",
            "position": "sticky",
            "color": "black",
            "bottom": 0,
        },
    ],
)


def layout(**kwargs):
    return (
        dbc.Row(
            [
                dbc.Col(
                    [
                        html.H4(
                            "Список узлов учета",  # Заголовок списка
                            id="gas_volume_calc_header",
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        list_of_gas_volume_calcs,
                    ],
                    width="auto",  # Set width to auto to match content width
                    style={
                        "height": "70vh",
                        "overflowY": "auto",
                        "display": "flex",
                        "flexDirection": "column",
                    },
                ),
                # Right column: DataTable
                dbc.Col(
                    [
                        html.H4(
                            "Суточный архив, ГРС-1",  # Заголовок списка
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        data_table,
                    ],
                    style={
                        "height": "70vh",
                        "overflowY": "auto",
                        "display": "flex",
                        "flexDirection": "column",
                        "flex": 1,
                    },
                ),
            ],
            className="mt-3",
        ),
    )


@callback(
    Output("table", "data"),
    Output("table", "style_data_conditional"),
    Input("list_table", "active_cell"),
    Input("selected_dates", "data"),
    State("list_table", "data"),
)
def point_list_click(active_cell, date_data, data_list):
    if active_cell:
        date_dicts = json.loads(date_data)
        row = active_cell["row"]
        params = {"gas_volume_calc_id": data_list[row]["id"]}
        if date_dicts["date_check"]:
            params["from_date"] = date_dicts["from_date"]
            params["to_date"] = date_dicts["to_date"]
        new_data = get_daily_data(**params)
        if not new_data:
            new_data = []
        new_style_data_conditional = [
            {
                "if": {
                    "row_index": len(new_data) - 1,
                },
                "backgroundColor": "lightblue",
                "fontWeight": "bold",
                "position": "sticky",
                "color": "black",
                "bottom": 0,
            },
        ]
        return new_data, new_style_data_conditional
    raise PreventUpdate
