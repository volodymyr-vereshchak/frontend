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
    "GRS_LINES_IDS": parse_int_list("GRS_LINES_IDS", [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11]),
    "GRS_TRENDS_IDS": parse_int_list("GRS_TRENDS_IDS", [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11]),
    "GRS_HIGH_P_LINES_IDS": parse_int_list("GRS_HIGH_P_LINES_IDS", [1, 6, 8, 12]),
    "GRS_PRESSURE_DIVISOR": int(os.getenv("GRS_PRESSURE_DIVISOR", "10000")),
}
