import os

from dotenv import load_dotenv

load_dotenv()

settings = {
    "BASE_API_URL": os.getenv("BASE_API_URL"),
    "API_PORT": os.getenv("API_PORT"),
    "SERVER_HOST": os.getenv("SERVER_HOST", "localhost"),
    "SERVER_PORT": int(os.getenv("SERVER_PORT", "8060")),
}
