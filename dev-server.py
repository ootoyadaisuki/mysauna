#!/usr/bin/env python3
"""開発用のローカルサーバー。

python -m http.server はキャッシュ制御のヘッダを送らないので、
ブラウザが古い JS / CSS を握ったままになり「直したのに画面が変わらない」が起きる。
このサーバーは毎回「保存するな」と伝えるので、リロードすれば必ず最新が出る。

使い方:  python3 dev-server.py [ポート番号]   (既定 8931)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=root)
    print(f'俺のサウナ 開発サーバー（キャッシュ無効）: http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
