"""
Static file server for React frontend deployment
For use with waitress-serve on Windows server
"""

import os
import mimetypes
from urllib.parse import unquote

class ReactApp:
    def __init__(self):
        # Path to React build files
        self.static_dir = os.path.join(os.path.dirname(__file__), 'react-frontend', 'dist')

    def __call__(self, environ, start_response):
        path = environ['PATH_INFO']

        # Remove leading slash and decode URL
        if path.startswith('/'):
            path = path[1:]
        path = unquote(path)

        # Default to index.html for root and SPA routing
        if not path or path.endswith('/'):
            path = 'index.html'

        # Get full file path
        full_path = os.path.join(self.static_dir, path)

        # Security check - prevent directory traversal
        if not os.path.abspath(full_path).startswith(os.path.abspath(self.static_dir)):
            return self._not_found(start_response)

        # For SPA routing - serve index.html if file doesn't exist and has no extension
        if not os.path.exists(full_path) and '.' not in os.path.basename(path):
            full_path = os.path.join(self.static_dir, 'index.html')

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
                content_type = 'application/octet-stream'

            # Read file
            with open(file_path, 'rb') as f:
                content = f.read()

            # Set headers
            headers = [
                ('Content-Type', content_type),
                ('Content-Length', str(len(content))),
                ('Cache-Control', 'no-cache' if file_path.endswith('.html') else 'public, max-age=86400')
            ]

            start_response('200 OK', headers)
            return [content]

        except Exception as e:
            return self._server_error(start_response, str(e))

    def _not_found(self, start_response):
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'File not found']

    def _server_error(self, start_response, error_msg):
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
        return [f'Server error: {error_msg}'.encode('utf-8')]

# Create WSGI application instance
server = ReactApp()

if __name__ == '__main__':
    # For local testing
    from wsgiref.simple_server import make_server
    with make_server('localhost', 8050, server) as httpd:
        print(f"Serving React app on http://localhost:8050")
        print(f"Static files from: {os.path.join(os.path.dirname(__file__), 'react-frontend', 'dist')}")
        httpd.serve_forever()