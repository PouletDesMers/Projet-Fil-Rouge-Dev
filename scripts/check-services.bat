@echo off
setlocal

REM Utiliser les variables d'environnement ou les valeurs par défaut
if "%API_URL%"=="" set API_URL=http://localhost:8080
if "%FRONTEND_URL%"=="" set FRONTEND_URL=http://localhost:3000

echo ========================================
echo  VERIFICATION DES SERVICES - CYNA
echo ========================================
echo.

echo [1/4] Statut des conteneurs Docker...
docker-compose ps
echo.

echo [2/4] Test API Backend (%API_URL%)...
curl -s -o nul -w "Status: %%{http_code}\n" %API_URL%/api/health
echo.

echo [3/4] Test Frontend Web (%FRONTEND_URL%)...
curl -s -o nul -w "Status: %%{http_code}\n" %FRONTEND_URL%
echo.

echo [4/4] Test Base de donnees...
docker-compose exec -T db pg_isready -U postgres
echo.

echo ========================================
echo  Verification terminee !
echo ========================================
echo.
echo Votre adresse IP locale (pour l'app mobile):
ipconfig | findstr /C:"IPv4"
echo.
pause
