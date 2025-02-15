TABLE_STYLE = {"height": "75vh"}
TABLE_CLASS_NAME = "ag-theme-alpine-dark"
DEFAULT_COL_DEF = {
    "cellRendererSelector": {"function": "rowPinningBottom(params)"},
    "resizable": True,
}

HEADER_STYLE = {
    "backgroundColor": "#1a1a1a",
    "color": "#ffffff",
    "fontWeight": "bold",
    "textAlign": "center",
    "fontSize": "12px",
}

ROW_STYLE = {"background": "#1a1a1a"}

CELL_STYLE = {
    "textAlign": "center",
    "cursor": "pointer",
    "border": "1px solid #2a2a2a",
}

# Define localization for numeric formatting
LOCALE_NUMBERS = """d3.formatLocale({
  "decimal": ",",
  "thousands": "\u00a0",
  "grouping": [3],
})"""
VALUE_FORMATTER = {"function": f"{LOCALE_NUMBERS}.format('$,.3f')(params.value)"}

BUTTON_STYLE = {
    "weight": "56px",
    "height": "56px",
    # "background-color": "#3E3E3E",
    "border": "0",
    "borderRadius": "4px",
}

ICON_STYLE = {"height": "40px"}
