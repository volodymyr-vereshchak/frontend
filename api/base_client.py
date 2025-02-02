from urllib.parse import urljoin
import requests
from config import settings
from utils.logger import logger_setup


class BaseClient:
    def __init__(self):
        self.base_url = settings.get("BASE_API_URL")
        self.port = settings.get("API_PORT")
        self.logger = logger_setup("frontend")
        self.endpoint = None

    def get_full_url(self, item_id: int = None):
        full_url = f"http://{self.base_url}:{self.port}"
        if self.endpoint:
            full_url = urljoin(full_url, self.endpoint)
        if item_id:
            full_url = urljoin(full_url, f"/{item_id}/")

        return full_url

    def api_get(
        self,
        params: dict = None,
    ):
        try:
            response = requests.get(url=self.get_full_url(), params=params)
            response.raise_for_status()
        except requests.exceptions.HTTPError as http_err:
            self.logger.debug(http_err)
            return None

        except requests.exceptions.RequestException as err:
            self.logger.debug(err)
            return None

        return response.json()

    def api_post(
        self,
        params: dict = None,
    ):
        try:
            response = requests.post(url=self.get_full_url(), params=params)
            response.raise_for_status()
        except requests.exceptions.HTTPError as http_err:
            self.logger.debug(http_err)
            return None

        except requests.exceptions.RequestException as err:
            self.logger.debug(err)
            return None

        return response.json()
