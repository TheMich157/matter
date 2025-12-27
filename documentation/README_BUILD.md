Build instructions

This project uses standard library modules plus a small custom library `govee_lan.py`.

To build a Windows single-file EXE (onefile) for the GUI app using `govee_app.py` as entrypoint:

PowerShell (recommended):

```powershell
# from project root
.\build_exe.ps1
```

Batch:

```bat
# from project root
build_exe.bat
```

What the scripts do:
- activate the local `.venv` if present
- install `pyinstaller` from `requirements.txt`
- run `pyinstaller --onefile --windowed --add-data "rules.json;." govee_all_in_one.py`

Notes:
- The build produces the executable in `dist\govee_all_in_one.exe`.
- `govee_all_in_one.py` includes the complete app with embedded GoveeLAN library and full automation UI.
- If you prefer a console app (to see logs), remove `--windowed` from the PyInstaller command in the script.
