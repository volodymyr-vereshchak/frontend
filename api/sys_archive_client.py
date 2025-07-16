from datetime import datetime
from pydantic import BaseModel

from api.base_client import BaseClient


class SysArchive(BaseModel):
    period: datetime
    line_id: int
    sys_type_id: int
    volume: float
    sys_name: str


class SysArchiveClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "sys/"
        self.pydantic_class = SysArchive
