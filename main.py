"""
Static file server for React frontend deployment
For use with waitress-serve on Windows server
"""

import os
import mimetypes
import re
from urllib.parse import unquote
from config import settings


class ReactApp:
    def __init__(self):
        # Path to React build files
        self.static_dir = os.path.join(
            os.path.dirname(__file__), "react-frontend", "dist"
        )

    def _inject_config_into_html(self, html_content):
        """Inject API configuration into HTML"""
        # Build API URL from settings
        api_url = f"http://{settings.get('BASE_API_URL', 'localhost')}:{settings.get('API_PORT', '8000')}"

        # Build GRS configuration
        grs_config = {
            "LINES_IDS": settings.get('GRS_LINES_IDS', []),
            "HIGH_P_LINES_IDS": settings.get('GRS_HIGH_P_LINES_IDS', []),
            "PRESSURE_DIVISOR": settings.get('GRS_PRESSURE_DIVISOR', 10000)
        }

        # Create config script
        config_script = f"""<script>
    window.APP_CONFIG = {{
        API_URL: '{api_url}',
        GRS_CONFIG: {grs_config}
    }};
</script>"""

        # Inject before closing head tag
        html_content = re.sub(
            r'</head>',
            f'{config_script}\n</head>',
            html_content,
            flags=re.IGNORECASE
        )

        return html_content

    def __call__(self, environ, start_response):
        path = environ["PATH_INFO"]

        # Remove leading slash and decode URL
        if path.startswith("/"):
            path = path[1:]
        path = unquote(path)

        # Default to index.html for root and SPA routing
        if not path or path.endswith("/"):
            path = "index.html"

        # Get full file path
        full_path = os.path.join(self.static_dir, path)

        # Security check - prevent directory traversal
        if not os.path.abspath(full_path).startswith(os.path.abspath(self.static_dir)):
            return self._not_found(start_response)

        # For SPA routing - serve index.html if file doesn't exist and has no extension
        if not os.path.exists(full_path) and "." not in os.path.basename(path):
            full_path = os.path.join(self.static_dir, "index.html")

        # Serve file if it exists
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return self._serve_file(full_path, start_response)
        else:
            return self._not_found(start_response)

    def _serve_file(self, file_path, start_response):
        try:
            # Get MIME type
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                content_type = "application/octet-stream"

            # Special handling for HTML files to inject configuration
            if file_path.endswith(".html"):
                # Read as text for HTML processing
                with open(file_path, "r", encoding="utf-8") as f:
                    html_content = f.read()

                # Inject configuration
                html_content = self._inject_config_into_html(html_content)
                content = html_content.encode("utf-8")
                content_type = "text/html; charset=utf-8"
            else:
                # Read as binary for other files
                with open(file_path, "rb") as f:
                    content = f.read()

            # Set headers
            headers = [
                ("Content-Type", content_type),
                ("Content-Length", str(len(content))),
                (
                    "Cache-Control",
                    "no-cache, no-store, must-revalidate"
                ),
                ("Pragma", "no-cache"),
                ("Expires", "0"),
            ]

            start_response("200 OK", headers)
            return [content]

        except Exception as e:
            return self._server_error(start_response, str(e))

    def _not_found(self, start_response):
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"File not found"]

    def _server_error(self, start_response, error_msg):
        start_response("500 Internal Server Error", [("Content-Type", "text/plain")])
        return [f"Server error: {error_msg}".encode("utf-8")]


# Create WSGI application instance
server = ReactApp()

if __name__ == "__main__":
    # For local testing
    from wsgiref.simple_server import make_server

    host = settings["SERVER_HOST"]
    port = settings["SERVER_PORT"]

    with make_server(host, port, server) as httpd:
        print(f"Serving React app on http://{host}:{port}")
        print(
            f"Static files from: {os.path.join(os.path.dirname(__file__), 'react-frontend', 'dist')}"
        )
        httpd.serve_forever()
