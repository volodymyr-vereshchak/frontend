import pandas as pd

from api.base_client import BaseClient


class LineClient(BaseClient):
    def __init__(self):
        super().__init__()
        self.endpoint = "lines/"

    def get_lines_list_by_lumg(self, lumg_id: int = 1):
        params = {"lumg_id": lumg_id}
        response = self.api_get(params=params)
        df = pd.DataFrame(response)

        return df
