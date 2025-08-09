import dash
from dash import Dash, html, dcc, callback, Input, Output
import dash_bootstrap_components as dbc
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from api.root_client import RootClient
from api.report_client import ReportClient
from pages.page_elements.main_button_elemets import BUTTON_SECTION
from pages.page_elements.main_date_time_picker_elements import get_date_picker_section
from pages.page_elements.report_elements import create_report_modal

# Import all callbacks to register them
import pages.callbacks

# External stylesheets
EXTERNAL_STYLESHEETS = [
    dbc.themes.DARKLY,
]

# Create the Dash app
app = Dash(
    __name__,
    use_pages=True,
    external_stylesheets=EXTERNAL_STYLESHEETS,
    suppress_callback_exceptions=True,
)
server = app.server


def layout():
    return dbc.Container(
        [
            dcc.Loading(
                [
                    BUTTON_SECTION,
                    html.Hr(),
                    get_date_picker_section(),
                    html.Hr(),
                    dcc.Store(id="update_state", data={"status": "init"}),
                    dcc.Store(id="selected_dates"),
                    create_report_modal(),
                    dash.page_container,
                ],
                overlay_style={"visibility": "visible", "filter": "blur(1px)"},
                type="dot",
            ),
        ],
        fluid=True,
        style={"backgroundColor": "#141414"},
    )


# Layout
app.layout = layout


@callback(
    Output("selected_dates", "data"),
    Input("date_checkbox", "value"),
    Input("from_date", "date"),
    Input("start_hour", "value"),
    Input("to_date", "date"),
    Input("end_hour", "value"),
)
def set_store_with_dates(
    date_check=False,
    from_date=None,
    start_hour=None,
    to_date=None,
    end_hour=None,
):
    ctx = dash.callback_context
    button_id = ctx.triggered[0]["prop_id"].split(".")[0]
    change = False
    if button_id in ["from_date", "start_hour", "to_date", "end_hour"]:
        change = True
    return (
        {
            "date_check": date_check,
            "change": change,
            "from_date": from_date,
            "start_hour": start_hour,
            "end_hour": end_hour,
            "to_date": to_date,
        }
        if date_check
        else {"date_check": False, "change": change}
    )


@callback(
    Output("update_state", "data"),
    Output("update_in_progress", "displayed"),
    Input("update", "n_clicks"),
    prevent_initial_call=True,
)
def update_db_from_archives(n_clicks: int):
    """Update database from archives with improved error handling"""
    try:
        result = RootClient().api_post()
        if result:
            status = "updated"
            update_flag = False
        else:
            status = "failed"
            update_flag = True
    except Exception as e:
        # Log the error for debugging
        import logging
        logging.error(f"Error updating database: {e}")
        status = f"error: {str(e)}"
        update_flag = True
    
    return {"status": status}, update_flag


# Active button callback is now in pages.callbacks.utility_callbacks


@app.callback(
    [
        Output("days", "active"),
        Output("hours", "active"),
        Output("sys", "active"),
        Output("edits", "active"),
        Output("param", "active"),
    ],
    [Input("active-button", "data")],
    prevent_initial_call=True,
)
def set_button_active(active_button):
    buttons = ["days", "hours", "sys", "edits", "param"]
    return [True if button == active_button else False for button in buttons]


if __name__ == "__main__":
    app.run_server(host="127.0.0.1", debug=True)
