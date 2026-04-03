@echo off
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
echo API Backend:     http://localhost:8080
echo Frontend Web:    http://localhost:3000
echo PostgreSQL DB:   localhost:5432
echo.
echo Pour lancer l'app mobile: npm start
echo Pour voir les logs: docker-compose logs -f
echo Pour tester l'API: test-api.bat
echo.
pause
