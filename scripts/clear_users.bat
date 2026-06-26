@echo off
chcp 65001 >nul
echo.
echo ================================================
echo   CYNA - Effacement de tous les utilisateurs
echo ================================================
echo.
echo  ATTENTION : action IRREVERSIBLE.
echo  Supprime : utilisateurs, sessions, tokens,
echo             commandes, tickets, notifications.
echo.
set /p confirm= Tapez OUI pour confirmer :

if /i "%confirm%" neq "OUI" (
    echo.
    echo  Annule - aucune modification.
    pause
    exit /b 0
)

echo.
echo  Suppression en cours...

docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM paiement"
docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM facture"
docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM commande"
docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM ticket_support"
docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM notification"
docker compose exec -T db psql -U postgres -d mydb -c "UPDATE categories SET id_utilisateur_creation = NULL"
docker compose exec -T db psql -U postgres -d mydb -c "UPDATE produits SET id_utilisateur_creation = NULL"
docker compose exec -T db psql -U postgres -d mydb -c "UPDATE carousel_images SET id_utilisateur_creation = NULL"
docker compose exec -T db psql -U postgres -d mydb -c "DELETE FROM utilisateur"

echo.
docker compose exec -T db psql -U postgres -d mydb -c "SELECT CONCAT('Resultat : ', COUNT(*), ' utilisateur(s) restant(s)') AS statut FROM utilisateur"

echo.
echo  Termine.
pause
