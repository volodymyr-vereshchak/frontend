import dash
from dash import Dash, html, dcc, callback, Input, Output
import dash_bootstrap_components as dbc
from datetime import datetime

# External stylesheets
EXTERNAL_STYLESHEETS = [
    dbc.themes.DARKLY,
    "https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css",
]

# Create the Dash app
app = Dash(__name__, use_pages=True, external_stylesheets=EXTERNAL_STYLESHEETS)

# Button section
BUTTON_SECTION = dbc.Container(
    dbc.Button(
        html.Img(src="assets/icons/day.svg", style={"height": "32px"}),
        id="daily_button",
        href="/",
        className="me-md-2",
    ),
    className="d-md-flex justify-content-start",
    style={
        "margin": 0,
        "margin-top": 10,
    },
)


# Date picker section
def create_date_picker(picker_id):
    return dcc.DatePickerSingle(
        date=datetime.today(),
        id=picker_id,
        display_format="DD.MM.YYYY",  # Формат отображения даты
        style={
            "zIndex": 1050,
            "width": "120px",  # Минимальная ширина
            "height": "30px",  # Минимальная высота
            "fontSize": "14px",  # Размер шрифта для удобства
            "padding": "5px",  # Отступы для визуального удобства
        },
    )


date_picker_section = dbc.Container(
    [
        dbc.Row(
            [
                dbc.Col(create_date_picker("from_date"), width="auto"),
                dbc.Col(create_date_picker("to_date"), width="auto"),
                dbc.Col(
                    dbc.Checkbox(id="date_checkbox"),
                    width="auto",
                    style={
                        "display": "flex",
                        "alignItems": "center",
                        "justifyContent": "center",
                    },
                ),
                dcc.Store(id="selected_dates"),
            ],
            justify="left",
            align="center",
        ),
        dash.html.Hr(),
    ],
    fluid=True,
)

# Layout
app.layout = dbc.Container(
    [
        BUTTON_SECTION,
        date_picker_section,
        dash.page_container,
    ],
    fluid=True,
)


# Callback to store selected dates
@callback(
    Output("selected_dates", "data"),
    Input("date_checkbox", "value"),
    Input("from_date", "date"),
    Input("to_date", "date"),
)
def set_store_with_dates(date_check=False, from_date=None, to_date=None):
    return (
        {"date_check": date_check, "from_date": from_date, "to_date": to_date}
        if date_check
        else {"date_check": False}
    )


if __name__ == "__main__":
    app.run_server(debug=True)
