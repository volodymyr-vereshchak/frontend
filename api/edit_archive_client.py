from datetime import datetime
from pydantic import BaseModel

from api.base_client import BaseClient


class EditArchive(BaseModel):
    period: datetime
    line_id: int
    edit_id: int
    old_value: int
    new_value: int


class EditArchiveClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "edit_archive/"
        self.pydantic_class = EditArchive
