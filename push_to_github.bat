@echo off
title Sambungkan & Push ke GitHub
color 0b
echo ===================================================================
echo   IndiBiz NetGuard - Sambungkan Project ke GitHub
echo ===================================================================
echo.
set /p REPO_URL="Masukkan URL Repository GitHub Anda (contoh: https://github.com/username/netguard.git): "

if "%REPO_URL%"=="" (
    echo [!] URL tidak boleh kosong. Silakan jalankan ulang script ini.
    pause
    exit /b
)

echo.
echo [*] Mengatur remote origin ke: %REPO_URL%
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo [*] Mengunggah (push) kode ke GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo   [SUKSES] Project IndiBiz NetGuard Berhasil Terhubung ke GitHub!
    echo ===================================================================
) else (
    echo.
    echo [!] Gagal push. Pastikan repository sudah dibuat di GitHub dan Anda sudah login.
)

echo.
pause
