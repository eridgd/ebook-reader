import http.server
import socketserver
import os
import argparse

PORT = 8080
BUILD_DIR = 'build'

class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Fallback to index.html if file doesn't exist
        requested_path = self.translate_path(self.path)
        if self.path != "/" and not os.path.exists(requested_path):
            self.path = '/index.html'
        return super().do_GET()

    def translate_path(self, path):
        # Strip query parameters and fragments
        path = path.split('?', 1)[0].split('#', 1)[0]
        # Normalize and build full file path relative to build dir
        path = os.path.normpath(os.path.join(BUILD_DIR, path.lstrip('/')))
        return path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Serve a SPA from the build directory.")
    parser.add_argument('--bind', default='', help='Address to bind to (default: all interfaces)')
    parser.add_argument('--port', type=int, default=8080, help='Port to serve on (default: 8080)')
    args = parser.parse_args()

    with socketserver.TCPServer((args.bind, args.port), SPARequestHandler) as httpd:
        bind_addr = args.bind if args.bind else "0.0.0.0"
        print(f"Serving at http://{bind_addr}:{args.port}")
        httpd.serve_forever()
