from datetime import datetime
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
        self.endpoint = "hourly/"
        self.pydantic_class = HourlyArchive
