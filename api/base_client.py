from urllib.parse import urljoin

import pandas as pd
import requests
from config import settings
from utils.logger import logger_setup


class BaseClient:
    def __init__(self):
        self.base_url = settings.get("BASE_API_URL")
        self.port = settings.get("API_PORT")
        self.logger = logger_setup("frontend")
        self.endpoint = None
        self.pydantic_class = None

    def get_full_url(self, item_id: int = None):
        full_url = f"http://{self.base_url}:{self.port}"
        if self.endpoint:
            full_url = urljoin(full_url, self.endpoint)
        if item_id:
            full_url = urljoin(full_url, f"/{item_id}/")

        return full_url

    def api_get(self, params: dict = None, url: str = None):
        if url is None:
            url = self.get_full_url()
        try:
            response = requests.get(url=url, params=params)
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

    def get_archives(self, from_date=None, to_date=None, line_id: list = None):
        params = {
            "from_date": from_date,
            "to_date": to_date,
            "line_id": line_id,
        }
        response = self.api_get(params=params)
        df = pd.DataFrame()
        if response:
            validated_data = [
                self.pydantic_class(**archive).model_dump() for archive in response
            ]
            df = pd.DataFrame(validated_data)
        return df

    def get_archive_counts(self, from_date=None, to_date=None, line_id: list = None):
        params = {
            "from_date": from_date,
            "to_date": to_date,
            "line_id": line_id,
        }
        url = self.get_full_url()[:-1] + "_counts/"
        response = self.api_get(params=params, url=url)
        df = pd.DataFrame()
        if response:
            df = pd.DataFrame(response)
        return df
