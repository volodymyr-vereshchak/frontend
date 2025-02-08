from datetime import date

import pandas as pd
from pydantic import BaseModel

from api.base_client import BaseClient


class DailyArchive(BaseModel):
    period: date
    volume: float
    w_volume_dp: float
    pressure: float
    temperature: float
    density: float


class DailyArchiveClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "day_archive/"

    def get_archives(
        self, from_date: date = None, to_date: date = None, line_id: list = None
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
                DailyArchive(**archive).model_dump() for archive in response
            ]
            df = pd.DataFrame(validated_data)
        return df
