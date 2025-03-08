import os

from dotenv import load_dotenv

load_dotenv()

settings = {
    "BASE_API_URL": os.getenv("BASE_API_URL"),
    "API_PORT": os.getenv("API_PORT"),
}
