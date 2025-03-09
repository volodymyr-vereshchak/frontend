import pandas as pd

from assets.styles import (
    VALUE_FORMATTER,
    TABLE_STYLE,
    TABLE_CLASS_NAME,
    DEFAULT_COL_DEF,
    CELL_STYLE,
    ROW_STYLE,
    VALUE_EDIT_FORMATTER,
)
import dash_ag_grid as dag

date_obj = "d3.timeParse('%Y-%m-%dT%H:%M:%S')(params.data.period) || d3.timeParse('%Y-%m-%d')(params.data.period)"

HOUR_DATE_COLUMNS = [
    dict(
        field="period",
        headerName="Дата",
        valueFormatter={
            "function": f"{date_obj} ? (params.data.period.includes('T') ? d3.timeFormat('%d.%m.%Y %H:%M:%S')({date_obj}) : d3.timeFormat('%d.%m.%Y')({date_obj})) : ''"
        },
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="volume",
        headerName="Объем с.у., м3",
        valueFormatter=VALUE_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="w_volume_dp",
        headerName="Перепад/Рабочий объем, м3",
        valueFormatter=VALUE_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="pressure",
        headerName="Давление, кг/см2",
        valueFormatter=VALUE_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="temperature",
        headerName="Температура, С",
        valueFormatter=VALUE_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="density",
        headerName="Плотность, кг/м3",
        valueFormatter=VALUE_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(field="edit_counts", headerName="И", cellStyle=CELL_STYLE),
    dict(field="sys_counts", headerName="А", cellStyle=CELL_STYLE),
]

SUMMARY_HOUR_DATE_COLUMNS = [
    HOUR_DATE_COLUMNS[0],
    HOUR_DATE_COLUMNS[1],
]

EDIT_COLUMNS = [
    dict(
        field="period",
        headerName="Дата",
        valueFormatter={
            "function": f"{date_obj} ? (params.data.period.includes('T') ? d3.timeFormat('%d.%m.%Y %H:%M:%S')({date_obj}) : d3.timeFormat('%d.%m.%Y')({date_obj})) : ''"
        },
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="edit_name",
        headerName="Тип изменения",
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="old_value",
        headerName="Значение до",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="new_value",
        headerName="Значение после",
        valueFormatter=VALUE_EDIT_FORMATTER,
        cellStyle=CELL_STYLE,
    ),
]

SYS_COLUMNS = [
    dict(
        field="period",
        headerName="Дата",
        valueFormatter={
            "function": f"{date_obj} ? (params.data.period.includes('T') ? d3.timeFormat('%d.%m.%Y %H:%M:%S')({date_obj}) : d3.timeFormat('%d.%m.%Y')({date_obj})) : ''"
        },
        cellStyle=CELL_STYLE,
    ),
    dict(
        field="sys_name",
        headerName="Тип аварии",
        cellStyle=CELL_STYLE,
    ),
    # dict(
    #     field="standard_volume",
    #     headerName="Объем",
    #     valueFormatter=VALUE_EDIT_FORMATTER,
    #     cellStyle=CELL_STYLE,
    # ),
]


def get_table_of_lines(id_name: str, data: pd.DataFrame, multiple: bool = True):
    return dag.AgGrid(
        id=id_name,
        rowData=data.to_dict("records"),
        rowStyle=ROW_STYLE,
        columnDefs=[
            dict(
                field="name_gas_volume", headerName="Узел учета", cellStyle=CELL_STYLE
            ),
            dict(
                field="name",
                headerName="Линия",
                checkboxSelection=True,
                cellStyle=CELL_STYLE,
            ),
        ],
        columnSize="sizeToFit",
        style=TABLE_STYLE,
        className=TABLE_CLASS_NAME,
        defaultColDef=DEFAULT_COL_DEF,
        dashGridOptions=(
            {
                "rowSelection": "multiple",
            }
            if multiple
            else {"rowSelection": "single"}
        ),
    )


def get_data_table(id_name: str, columns: list):
    return dag.AgGrid(
        id=id_name,
        rowData=pd.DataFrame().to_dict("records"),
        rowStyle=ROW_STYLE,
        columnDefs=columns,
        columnSize="responsiveSizeToFit",
        style=TABLE_STYLE,
        className=TABLE_CLASS_NAME,
        defaultColDef=DEFAULT_COL_DEF,
        dashGridOptions={
            "rowSelection": "single",
        },
    )
