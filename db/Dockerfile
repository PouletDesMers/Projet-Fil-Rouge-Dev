FROM postgres:15

ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password

# Initialisation en 2 étapes: schéma puis données de démonstration.
COPY 01_schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY 02_seed.sql /docker-entrypoint-initdb.d/02_seed.sql

EXPOSE 5432