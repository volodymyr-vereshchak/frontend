import pandas as pd

from api.base_client import BaseClient


class GasVolumeCalcClient(BaseClient):
    def __init__(self):
        super().__init__()
        self.endpoint = "gas-volume-calcs/"

    def get_gas_volume_list_by_lumg(self, lumg_id: int = 1):
        params = {"lumg_id": lumg_id}
        response = self.api_get(params=params)
        df = pd.DataFrame(response)

        return df


if __name__ == "__main__":
    gas_volume_calcs = GasVolumeCalcClient().api_get()
    pass
