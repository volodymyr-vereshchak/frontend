import dash

from dash import Dash, html, dcc
import dash_bootstrap_components as dbc
from datetime import date


# Create the Dash app
app = Dash(
    __name__,
    use_pages=True,
    external_stylesheets=[
        dbc.themes.DARKLY,
        "https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css",
    ],
)

app.layout = dbc.Container(
    [
        # Buttons section
        dbc.Container(
            [
                dbc.Button(
                    html.Img(src="assets/icons/day.svg", style={"height": "54px"}),
                    href="/",
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
        dash.page_container,
    ],
    fluid=True,
)


if __name__ == "__main__":
    # d_d = get_daily_archive(1)
    # print(d_d)
    app.run_server(debug=True)
