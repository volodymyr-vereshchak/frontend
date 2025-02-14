from calendar import firstweekday
from datetime import date
import dash_bootstrap_components as dbc

from dash import html, dcc


# Date picker section
def create_date_picker(picker_id):
    return dcc.DatePickerSingle(
        date=date.today(),
        first_day_of_week=1,
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
            "marginLeft": "8px",
            "fontSize": "large",
            "backgroundColor": "#181d1f",
            "color": "white",
            "border": "1px solid #3E3E3E",
            "boxShadow": "none",
            "appearance": "textfield",
            "paddingRight": "2px",
            "textAlign": "center",
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
                style={"marginTop": 5},
            ),
        ],
        fluid=True,
    )
