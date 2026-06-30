@echo off
setlocal

REM Utiliser la variable d'environnement ou la valeur par défaut
if "%API_URL%"=="" set API_URL=http://localhost:8080

echo ========================================
echo  TEST API BACKEND - CYNA
echo ========================================
echo.

echo [1/5] Test de sante de l'API...
curl -s %API_URL%/api/health
echo.
echo.

echo [2/5] Creation d'un utilisateur de test...
curl -X POST %API_URL%/api/users ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"firstName\":\"Test\",\"lastName\":\"User\",\"phone\":\"0612345678\",\"role\":\"client\"}"
echo.
echo.

echo [3/5] Connexion avec l'utilisateur de test...
curl -X POST %API_URL%/api/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\"}"
echo.
echo.

echo [4/5] Test des categories (peut necessiter authentification)...
curl -s %API_URL%/api/categories
echo.
echo.

echo [5/5] Verification de la base de donnees...
docker-compose exec -T db psql -U postgres -d mydb -c "SELECT COUNT(*) as total_users FROM utilisateur;"
echo.

echo ========================================
echo  Tests termines !
echo ========================================
echo.
echo Pour plus de tests, voir TEST_GUIDE.md
pause
