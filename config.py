import os

from dotenv import load_dotenv

load_dotenv()

def parse_int_list(env_var, default_list):
    """Parse comma-separated list of integers from environment variable."""
    env_value = os.getenv(env_var)
    if not env_value:
        return default_list
    try:
        return [int(x.strip()) for x in env_value.split(',') if x.strip()]
    except ValueError:
        return default_list

settings = {
    "BASE_API_URL": os.getenv("BASE_API_URL"),
    "API_PORT": os.getenv("API_PORT"),
    "SERVER_HOST": os.getenv("SERVER_HOST", "localhost"),
    "SERVER_PORT": int(os.getenv("SERVER_PORT", "8060")),

    # GRS Configuration
    # Virtual lines (1001-1004) + physical lines not in rings
    "GRS_LINES_IDS": parse_int_list("GRS_LINES_IDS", [6, 11, 16, 17, 18, 19, 20, 21, 1001, 1002, 1003, 1004]),
    "GRS_HIGH_P_LINES_IDS": parse_int_list("GRS_HIGH_P_LINES_IDS", [6, 1002]),  # Updated: 1002 (ring) instead of 1, 8
    "GRS_PRESSURE_DIVISOR": int(os.getenv("GRS_PRESSURE_DIVISOR", "10000")),
}
