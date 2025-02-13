import dash
from dash import Dash, html, dcc, callback, Input, Output
import dash_bootstrap_components as dbc

from api.root_client import RootClient
from pages.page_elements.main_button_elemets import BUTTON_SECTION
from pages.page_elements.main_date_time_picker_elements import get_date_picker_section

# External stylesheets
EXTERNAL_STYLESHEETS = [
    dbc.themes.DARKLY,
    "https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css",
]

# Create the Dash app
app = Dash(
    __name__,
    use_pages=True,
    external_stylesheets=EXTERNAL_STYLESHEETS,
    suppress_callback_exceptions=True,
)

date_picker_section = get_date_picker_section()

# Layout
app.layout = dbc.Container(
    [
        BUTTON_SECTION,
        html.Hr(),
        date_picker_section,
        html.Hr(),
        dcc.Loading(
            [
                dcc.Store(id="update_state", data={"status": "init"}),
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
    if not date_check:
        return {"date_check": False}
    return {
        "date_check": date_check,
        "from_date": from_date,
        "start_hour": start_hour,
        "end_hour": end_hour,
        "to_date": to_date,
    }


@callback(
    Output("update_state", "data"),
    Input("update", "n_clicks"),
    prevent_initial_call=True,
)
def update_db_from_archives(n_clicks: int):
    RootClient().api_post()
    result = "updated"
    return {"status": result}


@app.callback(
    Output("active-button", "data"),  # Сохраняем активную кнопку
    [
        Input("settings", "n_clicks"),
        Input("update", "n_clicks"),
        Input("lumgs", "n_clicks"),
        Input("days", "n_clicks"),
        Input("hours", "n_clicks"),
        Input("sys", "n_clicks"),
        Input("edits", "n_clicks"),
    ],
)
def update_active_button(*args):
    ctx = dash.callback_context
    if not ctx.triggered:
        return None
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    return button_id


@app.callback(
    [
        Output("settings", "active"),
        Output("update", "active"),
        Output("lumgs", "active"),
        Output("days", "active"),
        Output("hours", "active"),
        Output("sys", "active"),
        Output("edits", "active"),
    ],
    [Input("active-button", "data")],  # Следим за активной кнопкой
)
def set_button_active(active_button):
    # Для каждой кнопки присваиваем класс 'active', если она выбрана
    buttons = ["settings", "update", "lumgs", "days", "hours", "sys", "edits"]
    return [True if button == active_button else False for button in buttons]


if __name__ == "__main__":
    app.run_server(debug=True)
