from datetime import date
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
        self.pydantic_class = DailyArchive
