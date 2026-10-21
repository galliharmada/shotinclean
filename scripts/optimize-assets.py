#!/usr/bin/env python3
"""Convert generated marketing PNGs to WebP and remove the PNGs.

Run after scripts/marketing-shots.mjs:
    python3 scripts/optimize-assets.py
"""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / 'src' / 'landing' / 'assets'
NAMES = ['area-select', 'editor', 'quick-access', 'edited', 'recording', 'studio-history', 'video-editor', 'screen']

for name in NAMES:
    source = ASSETS / f'{name}.png'
    if not source.exists():
        continue
    target = ASSETS / f'{name}.webp'
    Image.open(source).convert('RGB').save(target, 'WEBP', quality=86, method=6)
    source.unlink()
    print(f'{name}: {target.stat().st_size // 1024} KB')
