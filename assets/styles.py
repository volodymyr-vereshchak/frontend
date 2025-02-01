TABLE_STYLE = {"height": "70vh"}
TABLE_CLASS_NAME = "ag-theme-alpine-dark"
DEFAULT_COL_DEF = {"cellRendererSelector": {"function": "rowPinningBottom(params)"}}

HEADER_STYLE = {
    "backgroundColor": "#1a1a1a",
    "color": "#ffffff",
    "fontWeight": "bold",
    "textAlign": "center",
    "fontSize": "12px",
}

CELL_STYLE = {
    "backgroundColor": "#2a2a2a",
    "color": "#ffffff",
    "textAlign": "center",
    "fontSize": "12px",
    "cursor": "pointer",
    "width": "100px",
}

# Define localization for numeric formatting
LOCALE_NUMBERS = """d3.formatLocale({
  "decimal": ",",
  "thousands": "\u00a0",
  "grouping": [3],
})"""
VALUE_FORMATTER = {"function": f"{LOCALE_NUMBERS}.format('$,.3f')(params.value)"}
