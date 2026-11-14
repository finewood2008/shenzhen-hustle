# 本地开发用的静态服务器：和 python -m http.server 一样，但禁止浏览器缓存，改了代码刷新就是最新的。
# 用法：python3 tools/serve.py [端口，默认 8123]
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
http.server.ThreadingHTTPServer(('', port), NoCache).serve_forever()
