from api.base_client import BaseClient


class RootClient(BaseClient):
    def __init__(self):
        super().__init__()
        self.endpoint = "update_data/"
