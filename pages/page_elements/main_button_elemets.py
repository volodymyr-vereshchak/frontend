import dash_bootstrap_components as dbc
from dash import html, dcc

from assets.styles import ICON_STYLE, BUTTON_STYLE


def get_button(icon_pass: str, id_name: str, href: str = None, active: bool = False):
    return dbc.Button(
        html.Img(src=icon_pass, style=ICON_STYLE),
        id=id_name,
        href=href,
        style=BUTTON_STYLE,
        className="me-md-2 btn-custom",
        active=active,
    )


# Button section
BUTTON_SECTION = dbc.Container(
    [
        get_button(icon_pass="assets/icons/settings.svg", id_name="settings", href="/"),
        get_button(icon_pass="assets/icons/refresh-double.svg", id_name="update"),
        get_button(icon_pass="assets/icons/bank.svg", id_name="lumgs", href="/"),
        get_button(
            icon_pass="assets/icons/calendar-2.svg",
            id_name="days",
            href="/",
        ),
        get_button(icon_pass="assets/icons/alarm.svg", id_name="hours", href="/hour"),
        get_button(
            icon_pass="assets/icons/iconoir_pc-warning.svg", id_name="sys", href="/"
        ),
        get_button(icon_pass="assets/icons/page-edit.svg", id_name="edits", href="/"),
        dcc.Store(id="active-button", data="days"),
    ],
    className="d-md-flex justify-content-start",
    style={
        "margin": 0,
        "marginTop": 10,
    },
)
