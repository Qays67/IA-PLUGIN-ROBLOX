@echo off
title XozHub AI
cd /d "%~dp0"
echo.
echo   XozHub AI - demarrage du serveur...
echo   Le navigateur va s'ouvrir sur http://localhost:8787
echo   Laisse cette fenetre OUVERTE : c'est le serveur.
echo.
echo   (Si Windows dit que "node" est introuvable, installe Node.js
echo    depuis https://nodejs.org puis relance ce fichier.)
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8787"
node server.js
echo.
echo   Le serveur s'est arrete.
pause
