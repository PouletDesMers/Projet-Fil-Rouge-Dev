@echo off
echo ========================================
echo  VERIFICATION DES SERVICES - CYNA
echo ========================================
echo.

echo [1/4] Statut des conteneurs Docker...
docker-compose ps
echo.

echo [2/4] Test API Backend (http://localhost:8080)...
curl -s -o nul -w "Status: %%{http_code}\n" http://localhost:8080/api/health
echo.

echo [3/4] Test Frontend Web (http://localhost:3000)...
curl -s -o nul -w "Status: %%{http_code}\n" http://localhost:3000
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
