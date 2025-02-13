from datetime import datetime

import pandas as pd
from dash import Patch
from dash.exceptions import PreventUpdate

from api.edit_archive_client import EditArchiveClient
from api.gas_volume_calc_client import GasVolumeCalcClient
from api.hourly_archive_client import HourlyArchiveClient
from api.line_client import LineClient
from api.sys_archive_client import SysArchiveClient
from pages.page_elements.table_elements import (
    SUMMARY_HOUR_DATE_COLUMNS,
    HOUR_DATE_COLUMNS,
)


def get_lines():
    list_data = LineClient().get_lines_list_by_lumg()
    gas_volume_data = GasVolumeCalcClient().get_gas_volume_list_by_lumg()
    if not (list_data.empty and gas_volume_data.empty):
        merge_data = list_data.merge(
            gas_volume_data.rename(
                columns={"name": "name_gas_volume", "id": "flow_id"}
            ),  # [["flow_id", "name_gas_volume", "address"]],
            left_on="gas_volume_calc_id",
            right_on="flow_id",
            how="left",
        ).sort_values(["address", "line"], ascending=[False, True])
    else:
        merge_data = pd.DataFrame()
    return merge_data


def update_table(active_cell, selected_rows, client, date_data, data_list):
    """Update table data based on user selection."""
    if not (selected_rows or active_cell):
        raise PreventUpdate
    if date_data["change"] and not date_data["date_check"]:
        raise PreventUpdate
    hour_flag = False
    if client == HourlyArchiveClient:
        hour_flag = True
    params = extract_params(selected_rows, active_cell, data_list, date_data, hour_flag)
    new_data = client().get_archives(**params)
    new_data = process_new_data(new_data)
    if len(params["line_id"]) == 1:
        edit_data = (
            EditArchiveClient()
            .get_archive_counts(**params)
            .rename(columns={"hour_group": "period", "record_count": "edit_counts"})
        )
        if not edit_data.empty:
            edit_data["period"] = pd.to_datetime(edit_data["period"])
            if hour_flag:
                edit_data = edit_data.set_index("period")
                new_data = pd.concat([new_data, edit_data], axis=1)
            else:
                edit_data["date"] = edit_data["period"].dt.date
                edit_data.loc[edit_data["period"].dt.hour < 7, "date"] -= pd.Timedelta(
                    days=1
                )
                edit_data = edit_data.fillna(0)
                edit_data = edit_data.groupby("date").sum(numeric_only=True)
                edit_data = edit_data[["edit_counts"]]
                new_data = pd.concat([new_data, edit_data], axis=1)
        else:
            new_data["edit_counts"] = 0

        sys_data = (
            SysArchiveClient()
            .get_archive_counts(**params)
            .rename(columns={"hour_group": "period", "record_count": "sys_counts"})
        )

        if not sys_data.empty:
            sys_data["period"] = pd.to_datetime(sys_data["period"])
            if hour_flag:
                sys_data = sys_data.set_index("period")
                new_data = pd.concat([new_data, sys_data], axis=1)
            else:
                sys_data["date"] = sys_data["period"].dt.date
                sys_data.loc[sys_data["period"].dt.hour < 7, "date"] -= pd.Timedelta(
                    days=1
                )
                sys_data = sys_data.groupby("date").sum(numeric_only=True)
                sys_data = sys_data[["sys_counts"]]
                new_data = pd.concat([new_data, sys_data], axis=1)
        else:
            new_data["sys_counts"] = 0

    new_data = (
        new_data.dropna(subset=["volume"])
        .fillna(0)
        .reset_index()
        .rename(columns={"index": "period"})
        .to_dict("records")
    )
    column_defs = (
        SUMMARY_HOUR_DATE_COLUMNS if len(params["line_id"]) > 1 else HOUR_DATE_COLUMNS
    )

    return new_data, column_defs


def extract_params(selected_rows, active_cell, data_list, date_data, hour_flag):
    """Extract parameters for fetching data based on user selection."""
    params = {}
    if selected_rows:
        params["line_id"] = [row["id"] for row in selected_rows]
    elif active_cell:
        params["line_id"] = [data_list[active_cell["rowIndex"]]["id"]]

    if date_data.get("date_check"):
        if hour_flag:
            params["from_date"], params["to_date"] = (
                datetime.strptime(date_data["from_date"], "%Y-%m-%d").replace(
                    hour=date_data["start_hour"]
                ),
                datetime.strptime(date_data["to_date"], "%Y-%m-%d").replace(
                    hour=date_data["end_hour"]
                ),
            )
        else:
            params["from_date"], params["to_date"] = (
                date_data["from_date"],
                date_data["to_date"],
            )

    return params


def process_new_data(new_data):
    """Process data and return formatted records."""
    if new_data.empty:
        return pd.DataFrame().to_dict("records")

    return new_data.groupby("period").sum(numeric_only=True)


def update_pinned_row(data_df):
    """Update pinned bottom row with summary values."""
    df = pd.DataFrame(data_df)

    if df.empty:
        aggregated_values = {
            "volume": 0,
            "w_volume_dp": 0,
            "pressure": 0,
            "temperature": 0,
            "density": 0,
            "edit_counts": 0,
            "sys_counts": 0,
        }
    else:
        if "edit_counts" in df.columns:
            aggregated_values = df.agg(
                {
                    "volume": "sum",
                    "w_volume_dp": "mean",
                    "pressure": "mean",
                    "temperature": "mean",
                    "density": "mean",
                    "edit_counts": "sum",
                    "sys_counts": "sum",
                }
            ).round(3)
        else:
            aggregated_values = df.agg(
                {
                    "volume": "sum",
                    "w_volume_dp": "mean",
                    "pressure": "mean",
                    "temperature": "mean",
                    "density": "mean",
                }
            ).round(3)

    patch = Patch()
    patch["pinnedBottomRowData"] = [{**aggregated_values}]
    return patch
