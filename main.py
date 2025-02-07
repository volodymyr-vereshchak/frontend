import dash
from dash import Dash, html, dcc, callback, Input, Output, no_update
import dash_bootstrap_components as dbc
from datetime import datetime, date

from api.root_client import RootClient
from assets.styles import BUTTON_STYLE, ICON_STYLE

# External stylesheets
EXTERNAL_STYLESHEETS = [
    dbc.themes.DARKLY,
    "https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css",
]

# Create the Dash app
app = Dash(__name__, use_pages=True, external_stylesheets=EXTERNAL_STYLESHEETS)


def get_button(icon_pass: str, id_name: str, href: str = None):
    return dbc.Button(
        html.Img(src=icon_pass, style=ICON_STYLE),
        id=id_name,
        href=href,
        style=BUTTON_STYLE,
        className="me-md-2",
    )


# Button section
BUTTON_SECTION = dbc.Container(
    [
        get_button(icon_pass="assets/icons/settings.svg", id_name="settings", href="/"),
        get_button(icon_pass="assets/icons/refresh-double.svg", id_name="update"),
        get_button(icon_pass="assets/icons/bank.svg", id_name="lumgs", href="/"),
        get_button(icon_pass="assets/icons/calendar-2.svg", id_name="days", href="/"),
        get_button(icon_pass="assets/icons/alarm.svg", id_name="hours", href="/hour"),
        get_button(
            icon_pass="assets/icons/iconoir_pc-warning.svg", id_name="sys", href="/"
        ),
        get_button(icon_pass="assets/icons/page-edit.svg", id_name="edits", href="/"),
    ],
    className="d-md-flex justify-content-start",
    style={
        "margin": 0,
        "margin-top": 10,
    },
)


# Date picker section
def create_date_picker(picker_id):
    return dcc.DatePickerSingle(
        date=date.today(),
        id=picker_id,
        display_format="DD.MM.YYYY",  # Формат отображения даты
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
            "height": "30px",
            "padding": 0,
            "margin-left": "8px",
            "font-size": "large",
            "background-color": "#181d1f",
            "color": "white",
        },
    )


date_picker_section = dbc.Container(
    [
        dbc.Row(
            [
                html.Label("Начало периода", style={"width": "auto"}),
                dbc.Col(create_date_picker("from_date"), width="auto"),
                get_time_picker(picker_id="start_hour"),
                html.Label("Конец периода", style={"width": "auto"}),
                dbc.Col(create_date_picker("to_date"), width="auto"),
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
        html.Hr(),
    ],
    fluid=True,
)

# Layout
app.layout = dbc.Container(
    [
        BUTTON_SECTION,
        date_picker_section,
        dcc.Loading(
            [
                dcc.Store(id="selected_dates"),
                dash.page_container,
            ],
            overlay_style={"visibility": "visible", "filter": "blur(1px)"},
            type="circle",
        ),
    ],
    fluid=True,
)


# Callback to store selected dates
@callback(
    Output("selected_dates", "data"),
    Input("date_checkbox", "value"),
    Input("from_date", "date"),
    Input("start_hour", "value"),
    Input("to_date", "date"),
    Input("end_hour", "value"),
)
def set_store_with_dates(
    date_check=False, from_date=None, start_hour=None, to_date=None, end_hour=None
):
    return (
        {
            "date_check": date_check,
            "from_date": from_date,
            "start_hour": start_hour,
            "end_hour": end_hour,
            "to_date": to_date,
        }
        if date_check
        else {"date_check": False}
    )


@callback(
    Output("selected_dates", "clear_data"),
    Input("update", "n_clicks"),
    prevent_initial_call=True,
)
def update_db_from_archives(n_clicks: int):
    RootClient().api_post()
    return no_update


if __name__ == "__main__":
    app.run_server(debug=True)
