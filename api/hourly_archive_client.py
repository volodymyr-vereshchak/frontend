from datetime import datetime

import pandas as pd
from pydantic import BaseModel

from api.base_client import BaseClient


class HourlyArchive(BaseModel):
    period: datetime
    volume: float
    w_volume_dp: float
    pressure: float
    temperature: float
    density: float


class HourlyArchiveClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "hour_archive/"

    def get_hourly_archives(
        self, from_date: datetime = None, to_date: datetime = None, line_id: list = None
    ):
        params = {
            "from_date": from_date,
            "to_date": to_date,
            "line_id": line_id,
        }
        response = self.api_get(params=params)
        df = pd.DataFrame()
        if response:
            validated_data = [
                HourlyArchive(**archive).model_dump() for archive in response
            ]
            df = pd.DataFrame(validated_data)
        return df
