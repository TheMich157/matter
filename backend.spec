# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

ROOT = os.path.abspath(os.path.dirname(__name__))


def build_datas():
    datas = []
    src_dir = os.path.join(ROOT, "src")
    for base, _dirs, files in os.walk(src_dir):
        for name in files:
            full = os.path.join(base, name)
            rel = os.path.relpath(full, ROOT)
            datas.append((full, rel))

    rules_path = os.path.join(ROOT, "rules.json")
    if os.path.exists(rules_path):
        datas.append((rules_path, "rules.json"))

    return datas


a = Analysis(
    ['app_backend.py'],
    pathex=[ROOT],
    binaries=[],
    datas=build_datas(),
    hiddenimports=collect_submodules('flask_cors'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='govee-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)
