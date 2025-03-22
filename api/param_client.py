from datetime import datetime
from pydantic import BaseModel

from api.base_client import BaseClient


class Param(BaseModel):
    period: datetime
    density: float
    co2: float
    n2: float
    D20: float
    d20: float
    cutoff: float
    roughness: float
    max_dp: float
    min_dp: float
    A0su: float
    A1su: float
    A2su: float
    A0pipe: float
    A1pipe: float
    A2pipe: float
    radius: float
    su_year: float
    max_p: float
    min_p: float
    max_t: float
    min_t: float


class ParamClient(BaseClient):
    def __init__(
        self,
    ):
        super().__init__()
        self.endpoint = "param/"
        self.pydantic_class = Param
