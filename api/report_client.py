from api.base_client import BaseClient


class ReportClient(BaseClient):
    def __init__(self):
        super().__init__()
        self.endpoint = "get_report/"

    def get_report(self):
        """Get gas volume report for the last 24 hours"""
        return self.api_get()
