@echo off
title IndiBiz NetGuard - Realtime Controller & Hostinger Cloud
color 0b
echo ===================================================================
echo   IndiBiz NetGuard NOC - FiberHome HG6145D2 ^& MikroTik Engine
echo   Status : Cloud Hostinger Online ^& Local Router Bridge
echo ===================================================================

:: Jalankan Node.js bridge server di latar belakang jika belum aktif
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [*] Menjalankan server bridge router lokal (Port 3000)...
    start /min "Indibiz_NetGuard_Bridge" node "%~dp0server.js"
    timeout /t 2 /nobreak >nul
) else (
    echo [*] Server bridge lokal aktif dan tersambung ke modem 192.168.1.1.
)

echo.
echo ===================================================================
echo   LINK AKSES ONLINE (Bisa dibuka di HP / Laptop di mana saja):
echo   >> https://netguard.mtsmambaulhikmah.sch.id
echo.
echo   LINK AKSES LOKAL (Komputer Rumah):
echo   >> http://localhost:3000
echo ===================================================================
echo.
echo [*] Membuka Dashboard Online di Browser...
start "" "https://netguard.mtsmambaulhikmah.sch.id"

timeout /t 3 >nul
exit
