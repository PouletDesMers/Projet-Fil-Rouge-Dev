FROM postgres:15

ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password

COPY Base.sql /docker-entrypoint-initdb.d/

EXPOSE 5432