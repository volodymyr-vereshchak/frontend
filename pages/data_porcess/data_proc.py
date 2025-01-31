import pandas as pd
from datetime import datetime, date

from pydantic import BaseModel

from api.daily_archive_client import DailyArchiveClient
from api.gas_volume_calc_client import GasVolumeCalcClient


class DailyArchive(BaseModel):
    period: date
    volume: float
    w_volume_dp: float
    pressure: float
    temperature: float
    density: float


def get_daily_data(
    from_date: datetime = None, to_date: datetime = None, gas_volume_calc_id: int = None
):
    response = DailyArchiveClient(
        from_date=from_date, to_date=to_date, gas_volume_calc_id=gas_volume_calc_id
    ).api_request()
    validated_data = [DailyArchive(**archive).model_dump() for archive in response]
    df = pd.DataFrame(validated_data)
    # if not df.empty:
    #     agg_func = {
    #         "volume": "sum",
    #         "w_volume_dp": "sum",
    #         "pressure": "mean",
    #         "temperature": "mean",
    #         "density": "mean",
    #     }
    #     sum_row = df.iloc[:, 1:].agg(agg_func)
    #     sum_row = pd.DataFrame([["Итого"] + sum_row.tolist()], columns=df.columns)
    #     df = pd.concat([df, sum_row], ignore_index=True)

    return df


def get_list_of_points():
    response = GasVolumeCalcClient().api_request()
    df = pd.DataFrame(response)

    return df
