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
    from_date: datetime = None,
    to_date: datetime = None,
    line_id: list = None,
):
    response = DailyArchiveClient().get_daily_archives(
        from_date=from_date, to_date=to_date, line_id=line_id
    )
    validated_data = [DailyArchive(**archive).model_dump() for archive in response]
    df = pd.DataFrame(validated_data)
    return df


def get_list_of_points():
    response = GasVolumeCalcClient().api_get()
    df = pd.DataFrame(response)
    if not df.empty:
        df = df.sort_values(["address"])

    return df
