import dash
from dash import Dash, html, dcc, callback, Input, Output, no_update
import dash_bootstrap_components as dbc
from datetime import datetime, date

from api.root_client import RootClient
from assets.styles import BUTTON_STYLE, ICON_STYLE
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
                dcc.Store(id="update_state"),
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
    Output("update_state", "data"),
    Input("update", "n_clicks"),
    prevent_initial_call=True,
)
def update_db_from_archives(n_clicks: int):
    RootClient().api_post()
    return {"status": "updated"}


if __name__ == "__main__":
    app.run_server(debug=True)
