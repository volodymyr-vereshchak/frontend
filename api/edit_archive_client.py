from datetime import datetime
from pydantic import BaseModel

from api.base_client import BaseClient


class EditArchive(BaseModel):
    period: datetime
    line_id: int
    edit_type_id: int
    old_value: int
    new_value: int
    edit_name: str


class EditArchiveClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "edit/"
        self.pydantic_class = EditArchive
