import pandas as pd

from assets.styles import (
    VALUE_FORMATTER,
    TABLE_STYLE,
    TABLE_CLASS_NAME,
    DEFAULT_COL_DEF,
)
import dash_ag_grid as dag


HOUR_DATE_COLUMNS = [
    dict(field="period", headerName="Дата"),
    dict(field="volume", headerName="Объем с.у., м3", valueFormatter=VALUE_FORMATTER),
    dict(
        field="w_volume_dp",
        headerName="Перепад/Рабочий объем, м3",
        valueFormatter=VALUE_FORMATTER,
    ),
    dict(
        field="pressure", headerName="Давление, кг/см2", valueFormatter=VALUE_FORMATTER
    ),
    dict(
        field="temperature", headerName="Температура, С", valueFormatter=VALUE_FORMATTER
    ),
    dict(
        field="density", headerName="Плотность, кг/м3", valueFormatter=VALUE_FORMATTER
    ),
    dict(
        field="edit_count",
        headerName="И",
    ),
    dict(
        field="sys_count",
        headerName="А",
    ),
]

SUMMARY_HOUR_DATE_COLUMNS = [
    HOUR_DATE_COLUMNS[0],
    HOUR_DATE_COLUMNS[1],
]


def get_table_of_lines(id_name: str, data: pd.DataFrame):
    return dag.AgGrid(
        id=id_name,
        rowData=data.to_dict("records"),
        columnDefs=[
            dict(field="name_gas_volume", headerName="Узел учета"),
            dict(field="name", headerName="Линия", checkboxSelection=True),
        ],
        columnSize="autoSize",
        style=TABLE_STYLE,
        className=TABLE_CLASS_NAME,
        defaultColDef=DEFAULT_COL_DEF,
        dashGridOptions={
            "rowSelection": "multiple",
            "suppressRowClickSelection": True,
        },
    )


def get_data_table(id_name: str):
    return dag.AgGrid(
        id=id_name,
        rowData=pd.DataFrame().to_dict("records"),
        columnDefs=HOUR_DATE_COLUMNS,
        style=TABLE_STYLE,
        className=TABLE_CLASS_NAME,
        defaultColDef=DEFAULT_COL_DEF,
        dashGridOptions={},
    )
