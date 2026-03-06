FROM postgres:15

ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password

# Fichier unique d'initialisation — remplace tous les anciens .sql éparpillés
COPY init.sql /docker-entrypoint-initdb.d/01_init.sql

EXPOSE 5432