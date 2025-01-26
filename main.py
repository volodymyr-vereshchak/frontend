from dataclasses import dataclass, asdict
from decimal import Decimal

from dash.dash_table.Format import Format, Scheme
from pydantic import BaseModel
from urllib.parse import urljoin

from dash import Dash, html, dash_table, Input, Output, State, dcc, callback
from dash.exceptions import PreventUpdate
import dash_bootstrap_components as dbc
import pandas as pd
from datetime import date
import requests

from config import settings


def get_list_of_points():
    full_url = f"http://{settings.get("BASE_API_URL")}:{settings.get("API_PORT")}"
    full_url = urljoin(full_url, "gas_volume_calcs/")
    response = requests.get(url=full_url).json()
    return pd.DataFrame(response)


class DailyArchive(BaseModel):
    period: date
    volume: Decimal
    w_volume_dp: Decimal
    pressure: Decimal
    temperature: Decimal
    density: Decimal


def get_daily_archive(gas_id: int):
    params = {"gas_volume_calc_id": gas_id}
    full_url = f"http://{settings.get("BASE_API_URL")}:{settings.get("API_PORT")}"
    full_url = urljoin(full_url, "day_archive/")
    response = requests.get(url=full_url, params=params).json()
    validated_data = [DailyArchive(**user).model_dump() for user in response]
    df = pd.DataFrame(validated_data)
    agg_func = {
        "volume": "sum",
        "w_volume_dp": "sum",
        "pressure": "mean",
        "temperature": "mean",
        "density": "mean",
    }
    sum_row = df.iloc[:, 1:].agg(agg_func)
    sum_row = pd.DataFrame([["Итого"] + sum_row.tolist()], columns=df.columns)
    df = pd.concat([df, sum_row], ignore_index=True)
    return df


# Create the Dash app
app = Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.DARKLY,
        "https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css",
    ],
)

# Generate example data with date column
num_rows = 100
date_range = pd.date_range(start="2023-01-01", periods=num_rows, freq="D")

data_df = get_daily_archive(1)
data = data_df.to_dict("records")

# Example columns for the DataTable
columns = [
    dict(id="period", name="period"),
    dict(
        id="volume",
        name="volume",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="w_volume_dp",
        name="w_volume_dp",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="pressure",
        name="pressure",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="temperature",
        name="temperature",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
    dict(
        id="density",
        name="density",
        type="numeric",
        format=Format(precision=2, scheme=Scheme.fixed).group(True),
    ),
]

list_data_df = get_list_of_points()
list_data = list_data_df.to_dict("records")

list_columns = [
    {"name": col, "id": col} for col in list_data_df.columns if col == "name"
]


# Function to format the date as "YYYY-MM"
def format_date(date):
    return date.strftime("%Y-%m")


app.layout = dbc.Container(
    [
        # Buttons section
        dbc.Container(
            [
                dbc.Button(
                    html.Img(src="assets/icons/day.svg", style={"height": "54px"}),
                    className="me-md-2",
                ),
            ],
            className="p-1 d-md-flex justify-content-center",
        ),
        dbc.Container(
            dbc.Row(
                [
                    dbc.Col(
                        dcc.DatePickerSingle(
                            date=date(2017, 6, 21),
                            display_format="MMMM Y, DD",
                            style={"zIndex": 1050},
                        ),
                        width="auto",
                    ),
                    dbc.Col(
                        dcc.DatePickerSingle(
                            date=date(2017, 6, 21),
                            display_format="MMMM Y, DD",
                            style={"zIndex": 1050},
                        ),
                        width="auto",
                    ),
                    dbc.Col(dbc.Checkbox(), width="auto"),
                ],
                justify="center",
                align="center",
            ),
            fluid=True,
        ),
        # Main content section
        dbc.Row(
            [
                # Left column: Clickable list
                dbc.Col(
                    [
                        html.H4(
                            "Список элементов",  # Заголовок списка
                            id="list_text",
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        dash_table.DataTable(
                            id="list_table",
                            columns=list_columns,
                            data=list_data,
                            fixed_rows={"headers": True},
                            style_table={
                                "height": "100%",
                                "maxHeight": "70vh",
                                "overflowY": "auto",
                                "border": "1px solid #444",
                                "width": "100%",  # Ensure the table takes up all remaining space
                            },
                            style_header={
                                "backgroundColor": "#1a1a1a",
                                "color": "#ffffff",
                                "fontWeight": "bold",
                                "textAlign": "center",
                                "fontSize": "14px",  # Smaller font size for header
                            },
                            style_cell={
                                "backgroundColor": "#2a2a2a",
                                "color": "#ffffff",
                                "textAlign": "center",
                                "fontSize": "14px",  # Smaller font size for table cells
                                "cursor": "pointer",
                            },
                        ),
                    ],
                    width="auto",  # Set width to auto to match content width
                    style={
                        "height": "70vh",  # Высота 70% от высоты экрана
                        "overflowY": "auto",  # Вертикальная прокрутка
                        "display": "flex",  # Гибкая раскладка
                        "flexDirection": "column",  # Вертикальное выравнивание содержимого
                    },
                ),
                # Right column: DataTable
                dbc.Col(
                    [
                        html.H4(
                            "Суточный архив, ГРС-1",  # Заголовок списка
                            className="text-center text-white mb-3",  # Классы стилей
                        ),
                        dash_table.DataTable(
                            id="table",
                            columns=columns,
                            data=data,
                            fixed_rows={"headers": True},
                            style_table={
                                "height": "100%",
                                "maxHeight": "70vh",
                                "overflowY": "auto",
                                "border": "1px solid #444",
                                "width": "100%",  # Ensure the table takes up all remaining space
                            },
                            style_header={
                                "backgroundColor": "#1a1a1a",
                                "color": "#ffffff",
                                "fontWeight": "bold",
                                "textAlign": "center",
                                "fontSize": "14px",  # Smaller font size for header
                            },
                            style_cell={
                                "backgroundColor": "#2a2a2a",
                                "color": "#ffffff",
                                "textAlign": "center",
                                "fontSize": "14px",  # Smaller font size for table cells
                                "cursor": "pointer",
                            },
                            # Format the first column as Date
                            style_data_conditional=[
                                {
                                    "if": {"column_id": "Date"},
                                    "format": "yyyy-mm",
                                },
                                {
                                    "if": {
                                        "row_index": len(data) - 1,  # Last row
                                    },
                                    "backgroundColor": "lightblue",  # Change the background color
                                    "fontWeight": "bold",  # Make the font bold
                                    "position": "sticky",
                                    "color": "black",
                                    "bottom": 0,
                                },
                            ],
                        ),
                    ],
                    # width=9,  # The column with the table will take 9 parts of the space
                    style={
                        "height": "70vh",  # Высота 70% от высоты экрана
                        "overflowY": "auto",  # Вертикальная прокрутка
                        "display": "flex",  # Гибкая раскладка
                        "flexDirection": "column",  # Вертикальное выравнивание содержимого
                        "flex": 1,
                    },  # Use flex to stretch the column
                ),
            ],
            className="mt-3",
        ),
    ],
    fluid=True,
)


@callback(
    Output("table", "data"),
    Input("list_table", "active_cell"),
    State("list_table", "data"),
)
def point_list_click(active_cell, data_list):
    if active_cell:
        row = active_cell["row"]
        return get_daily_archive(data_list[row]["id"]).to_dict("records")
    raise PreventUpdate


if __name__ == "__main__":
    # d_d = get_daily_archive(1)
    # print(d_d)
    app.run_server(debug=True)
