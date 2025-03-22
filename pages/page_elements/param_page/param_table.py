from assets.styles import CELL_STYLE, VALUE_EDIT_FORMATTER
from pages.page_elements.table_elements import date_obj

PARAM_COLUMNS = [
    dict(
        field="period",
        headerName="Дата",
        valueFormatter={
            "function": f"{date_obj} ? (params.data.period.includes('T') ? d3.timeFormat('%d.%m.%Y %H:%M:%S')({date_obj}) : d3.timeFormat('%d.%m.%Y')({date_obj})) : ''"
        },
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="density",
        headerName="Плотность",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="co2",
        headerName="CO2",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="n2",
        headerName="N2",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="D20",
        headerName="D20",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="d20",
        headerName="d20",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="cutoff",
        headerName="Отсечка",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="roughness",
        headerName="Шераховатость",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="max_dp",
        headerName="Макс. перепад/расход",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="min_dp",
        headerName="Мин. перепад/расход",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A0su",
        headerName="A0 су",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A1su",
        headerName="A1 су",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A2su",
        headerName="A2 су",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A0pipe",
        headerName="A0 трубы",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A1pipe",
        headerName="A1 трубы",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="A2pipe",
        headerName="A2 трубы",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="radius",
        headerName="Радиус",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="su_year",
        headerName="Интервал, год",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="max_p",
        headerName="Макс. давление",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="min_p",
        headerName="Мин. давление",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="max_t",
        headerName="Макс. температура",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="min_t",
        headerName="Мин. температура",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
]
