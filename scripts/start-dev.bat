@echo off
setlocal

REM Utiliser les variables d'environnement ou les valeurs par défaut
if "%API_URL%"=="" set API_URL=http://localhost:8080
if "%FRONTEND_URL%"=="" set FRONTEND_URL=http://localhost:3000

echo ========================================
echo  DEMARRAGE ENVIRONNEMENT DE DEV - CYNA
echo ========================================
echo.

echo [1/3] Demarrage des services Docker...
docker-compose up -d
echo.

echo [2/3] Attente du demarrage de l'API (10 secondes)...
timeout /t 10 /nobreak > nul
echo.

echo [3/3] Verification des services...
docker-compose ps
echo.

echo ========================================
echo  Services demarres !
echo ========================================
echo.
echo API Backend:     %API_URL%
echo Frontend Web:    %FRONTEND_URL%
echo PostgreSQL DB:   %DB_HOST%:%DB_PORT%
echo.
echo Pour lancer l'app mobile: npm start
echo Pour voir les logs: docker-compose logs -f
echo Pour tester l'API: test-api.bat
echo.
pause
