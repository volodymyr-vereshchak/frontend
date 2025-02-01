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
    gas_volume_calc_id: list = None,
):
    response = DailyArchiveClient(
        from_date=from_date, to_date=to_date, gas_volume_calc_id=gas_volume_calc_id
    ).api_request()
    validated_data = [DailyArchive(**archive).model_dump() for archive in response]
    df = pd.DataFrame(validated_data)
    return df


def get_list_of_points():
    response = GasVolumeCalcClient().api_request()
    df = pd.DataFrame(response).sort_values(["address", "line"])

    return df
