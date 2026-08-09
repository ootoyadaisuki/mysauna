#!/usr/bin/env python3
"""ライバル店の一枚絵を、ゲームに入る形（WebP）に変換する。

使い方:
    1. 作った絵を assets/story/_原本/ に置く。ファイル名は「キー名.png」
       （例: y_lumina_bath.png）。拡張子は png / jpg / webp どれでもいい。
    2. python3 tools/story_img.py

    _原本/ の中身を全部 assets/story/キー名.webp に変換する。
    元のファイルは消さない（あとで作り直せるように残しておく）。

    特定の1枚だけやり直したいときは:
    python3 tools/story_img.py y_lumina_bath
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'story', '_原本')
OUT = os.path.join(ROOT, 'assets', 'story')

WIDTH = 1280        # 画面の表示幅は420px。3倍あれば高精細な端末でもぼやけない
QUALITY = 88        # ドット絵は輪郭が硬いので、これ以上下げると縁が濁る
EXTS = ('.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG', '.JPEG', '.WEBP')


def convert(path, key):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    if w > WIDTH:
        # ドット絵を縮めるので、輪郭がにじまない LANCZOS ではなく BOX（面積平均）を使う
        im = im.resize((WIDTH, round(h * WIDTH / w)), Image.BOX)
    dst = os.path.join(OUT, key + '.webp')
    im.save(dst, 'WEBP', quality=QUALITY, method=6)
    kb = os.path.getsize(dst) / 1024
    print(f'  {key:22s} {w}x{h} → {im.size[0]}x{im.size[1]}  {kb:.0f}KB')
    return kb


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    if not os.path.isdir(SRC):
        print('assets/story/_原本/ が無い'); return
    files = [f for f in sorted(os.listdir(SRC)) if f.endswith(EXTS)]
    if only:
        files = [f for f in files if os.path.splitext(f)[0] == only]
        if not files:
            print(f'_原本/ に {only} が無い'); return
    if not files:
        print('_原本/ に画像が無い。絵をここに置いてから、もう一度。'); return

    print(f'{len(files)}枚を変換します')
    total = 0
    for f in files:
        total += convert(os.path.join(SRC, f), os.path.splitext(f)[0])
    print(f'合計 {total/1024:.1f}MB → assets/story/')


if __name__ == '__main__':
    main()
