@echo off
chcp 65001 > nul
echo Запуск автоматического сохранения сайта SeedAim Cloud...
cd /d "%~dp0"
python save_full_site.py
pause
