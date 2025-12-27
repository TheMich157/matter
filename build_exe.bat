@echo off
REM Simple batch wrapper to build govee_app.exe using PyInstaller
if exist .venv\Scripts\activate.bat (
  call .venv\Scripts\activate.bat
)

@echo Installing build requirements (PyInstaller)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

@echo Building exe from govee_all_in_one.py (complete app with embedded GoveeLAN)...
REM On Windows the --add-data separator is a semicolon
pyinstaller --noconfirm --onefile --windowed --add-data "rules.json;." govee_all_in_one.py

echo Build finished. Output in the 'dist' folder.
