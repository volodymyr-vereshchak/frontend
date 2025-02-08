from datetime import date
import dash_bootstrap_components as dbc

from dash import html, dcc


# Date picker section
def create_date_picker(picker_id):
    return dcc.DatePickerSingle(
        date=date.today(),
        id=picker_id,
        display_format="DD.MM.YYYY",
        style={
            "zIndex": 1050,
            "width": "120px",
            "height": "30px",
            "fontSize": "14px",
        },
    )


def get_time_picker(picker_id):
    return dcc.Input(
        id=picker_id,
        type="number",
        min=0,
        max=23,
        step=1,
        value=7,
        style={
            "width": "auto",
            "height": "26px",
            "padding": 0,
            "margin-left": "8px",
            "font-size": "large",
            "background-color": "#181d1f",
            "color": "white",
            "border": "1px solid #3E3E3E",
            "box-shadow": "none",
            "appearance": "textfield",
            "padding-right": "2px",
            "text-align": "center",
        },
    )


def get_date_picker_section():
    return dbc.Container(
        [
            dbc.Row(
                [
                    html.Label("Начало периода", style={"width": "auto"}),
                    dbc.Col(create_date_picker("from_date"), width="auto"),
                    html.Label("час", style={"width": "auto"}),
                    get_time_picker(picker_id="start_hour"),
                    html.Label("Конец периода", style={"width": "auto"}),
                    dbc.Col(create_date_picker("to_date"), width="auto"),
                    html.Label("час", style={"width": "auto"}),
                    get_time_picker(picker_id="end_hour"),
                    dbc.Col(
                        dbc.Checkbox(id="date_checkbox"),
                        width="auto",
                        style={
                            "display": "flex",
                            "alignItems": "center",
                            "justifyContent": "center",
                        },
                    ),
                ],
                justify="start",
                align="center",
                style={"margin-top": 5},
            ),
        ],
        fluid=True,
    )
