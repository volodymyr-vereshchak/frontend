from urllib.parse import urljoin
from typing import Optional, Dict, Any, List
import time

import pandas as pd
import requests
from config import settings
from utils.logger import logger_setup


class APIError(Exception):
    """Custom exception for API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, url: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.url = url
        super().__init__(self.message)


class BaseClient:
    def __init__(self):
        self.base_url = settings.get("BASE_API_URL")
        self.port = settings.get("API_PORT")
        self.logger = logger_setup("frontend")
        self.endpoint = None
        self.pydantic_class = None
        self.max_retries = 3
        self.retry_delay = 1  # seconds

    def get_full_url(self, item_id: int = None) -> str:
        """Build full URL for API request"""
        if not self.base_url or not self.port:
            raise APIError("API configuration is missing. Check BASE_API_URL and API_PORT in .env file")
            
        full_url = f"http://{self.base_url}:{self.port}"
        if self.endpoint:
            full_url = urljoin(full_url, self.endpoint)
        if item_id:
            full_url = urljoin(full_url, f"/{item_id}/")

        return full_url

    def _make_request(self, method: str, url: str, params: Optional[Dict] = None, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with retry logic and error handling"""
        headers = {"Accept-Encoding": "gzip"}
        headers.update(kwargs.get("headers", {}))
        
        for attempt in range(self.max_retries):
            try:
                self.logger.debug(f"Making {method.upper()} request to {url} (attempt {attempt + 1})")
                
                if method.lower() == "get":
                    response = requests.get(url=url, params=params, headers=headers, timeout=30)
                elif method.lower() == "post":
                    response = requests.post(url=url, params=params, headers=headers, timeout=30)
                else:
                    raise APIError(f"Unsupported HTTP method: {method}")
                
                response.raise_for_status()
                
                # Log successful response
                self.logger.debug(f"Successful {method.upper()} request to {url}")
                return response.json()
                
            except requests.exceptions.Timeout as e:
                self.logger.warning(f"Timeout error on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries - 1:
                    raise APIError(f"Request timeout after {self.max_retries} attempts: {url}")
                    
            except requests.exceptions.HTTPError as e:
                self.logger.error(f"HTTP error on attempt {attempt + 1}: {e.response.status_code} - {e.response.text}")
                if attempt == self.max_retries - 1:
                    raise APIError(
                        f"HTTP {e.response.status_code} error: {e.response.text}",
                        status_code=e.response.status_code,
                        url=url
                    )
                    
            except requests.exceptions.ConnectionError as e:
                self.logger.error(f"Connection error on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries - 1:
                    raise APIError(f"Connection failed after {self.max_retries} attempts: {url}")
                    
            except requests.exceptions.RequestException as e:
                self.logger.error(f"Request error on attempt {attempt + 1}: {e}")
                if attempt == self.max_retries - 1:
                    raise APIError(f"Request failed after {self.max_retries} attempts: {e}")
            
            # Wait before retry
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
        
        raise APIError(f"Request failed after {self.max_retries} attempts")

    def api_get(self, params: Optional[Dict] = None, url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Make GET request with improved error handling"""
        try:
            if url is None:
                url = self.get_full_url()
            
            result = self._make_request("get", url, params)
            return result
            
        except APIError as e:
            self.logger.error(f"API GET error: {e.message}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error in api_get: {e}")
            return None

    def api_post(self, params: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Make POST request with improved error handling"""
        try:
            url = self.get_full_url()
            result = self._make_request("post", url, params)
            return result
            
        except APIError as e:
            self.logger.error(f"API POST error: {e.message}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error in api_post: {e}")
            return None

    def get_archives(self, from_date=None, to_date=None, line_id: Optional[List[int]] = None) -> pd.DataFrame:
        """Get archives with improved error handling and validation"""
        try:
            params = {
                "from_date": from_date,
                "to_date": to_date,
                "line_id": line_id,
            }
            
            # Validate pydantic class is set
            if not self.pydantic_class:
                self.logger.error("Pydantic class not set for archive client")
                return pd.DataFrame()
            
            columns = [column for column in self.pydantic_class.__fields__.keys()]
            response = self.api_get(params=params)
            
            if not response:
                self.logger.warning("No response from archive API")
                return pd.DataFrame(columns=columns)
            
            # Validate and process response
            try:
                validated_data = [
                    self.pydantic_class(**archive).model_dump() for archive in response
                ]
                df = pd.DataFrame(validated_data).sort_values("period")
                self.logger.debug(f"Successfully loaded {len(df)} archive records")
                return df
                
            except Exception as e:
                self.logger.error(f"Error validating archive data: {e}")
                return pd.DataFrame(columns=columns)
                
        except Exception as e:
            self.logger.error(f"Error in get_archives: {e}")
            return pd.DataFrame()

    def get_archive_counts(self, from_date=None, to_date=None, line_id: Optional[List[int]] = None) -> pd.DataFrame:
        """Get archive counts with improved error handling"""
        try:
            params = {
                "from_date": from_date,
                "to_date": to_date,
                "line_id": line_id,
            }
            url = self.get_full_url()[:-1] + "_counts/"
            response = self.api_get(params=params, url=url)
            
            if not response:
                self.logger.warning("No response from archive counts API")
                return pd.DataFrame()
            
            df = pd.DataFrame(response)
            self.logger.debug(f"Successfully loaded {len(df)} count records")
            return df
            
        except Exception as e:
            self.logger.error(f"Error in get_archive_counts: {e}")
            return pd.DataFrame()
