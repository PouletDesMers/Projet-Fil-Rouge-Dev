-----CATEGORIE
CREATE TABLE categorie (
    id_categorie SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    actif BOOLEAN DEFAULT TRUE
);

-----SERVICE
CREATE TABLE service (
    id_service SERIAL PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    description TEXT,
    actif BOOLEAN DEFAULT TRUE,
    id_categorie INT NOT NULL,
    CONSTRAINT fk_service_categorie
        FOREIGN KEY (id_categorie)
        REFERENCES categorie(id_categorie)
);

-----PRODUIT
CREATE TABLE produit (
    id_produit SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    sur_devis BOOLEAN DEFAULT FALSE,
    actif BOOLEAN DEFAULT TRUE,
    id_service INT NOT NULL,
    CONSTRAINT fk_produit_service
        FOREIGN KEY (id_service)
        REFERENCES service(id_service)
);

-----TARIFICATION
CREATE TABLE tarification (
    id_tarification SERIAL PRIMARY KEY,
    prix NUMERIC(10,2),
    unite VARCHAR(30),       
    periodicite VARCHAR(20), 
    actif BOOLEAN DEFAULT TRUE,
    id_produit INT NOT NULL,
    CONSTRAINT fk_tarification_produit
        FOREIGN KEY (id_produit)
        REFERENCES produit(id_produit)
);

-----ENTREPRISE
CREATE TABLE entreprise (
    id_entreprise SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    secteur VARCHAR(100),
    taille VARCHAR(50),
    pays VARCHAR(50),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----UTILISATEUR
CREATE TABLE utilisateur (
    id_utilisateur SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    telephone VARCHAR(30),
    role VARCHAR(30), -- client, admin, support
    statut VARCHAR(30) DEFAULT 'actif',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    derniere_connexion TIMESTAMP,
    id_entreprise INT,
    -- 2FA fields
    totp_secret TEXT,
    webauthn_credential_id TEXT,
    webauthn_public_key TEXT,
    webauthn_counter BIGINT DEFAULT 0,
    CONSTRAINT fk_utilisateur_entreprise
        FOREIGN KEY (id_entreprise)
        REFERENCES entreprise(id_entreprise)
);

-----ABONNEMENT
CREATE TABLE abonnement (
    id_abonnement SERIAL PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE,
    quantite INT,
    statut VARCHAR(30), -- actif, suspendu, resilie
    renouvellement_auto BOOLEAN DEFAULT TRUE,
    id_entreprise INT NOT NULL,
    id_produit INT NOT NULL,
    id_tarification INT NOT NULL,
    CONSTRAINT fk_abonnement_entreprise
        FOREIGN KEY (id_entreprise)
        REFERENCES entreprise(id_entreprise),
    CONSTRAINT fk_abonnement_produit
        FOREIGN KEY (id_produit)
        REFERENCES produit(id_produit),
    CONSTRAINT fk_abonnement_tarification
        FOREIGN KEY (id_tarification)
        REFERENCES tarification(id_tarification)
);

----- FACTURATION//COMMANDE
CREATE TABLE commande (
    id_commande SERIAL PRIMARY KEY,
    date_commande TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    montant_total NUMERIC(10,2),
    statut VARCHAR(30), -- paye, echec, attente
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_commande_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur)
);

-----FACTURE
CREATE TABLE facture (
    id_facture SERIAL PRIMARY KEY,
    date_facture DATE,
    montant NUMERIC(10,2),
    lien_pdf TEXT,
    id_commande INT UNIQUE NOT NULL,
    CONSTRAINT fk_facture_commande
        FOREIGN KEY (id_commande)
        REFERENCES commande(id_commande)
);
-----PAIEMENT
CREATE TABLE paiement (
    id_paiement SERIAL PRIMARY KEY,
    moyen VARCHAR(50), -- CB, PayPal
    statut VARCHAR(30),
    date_paiement TIMESTAMP,
    reference_externe VARCHAR(150),
    id_commande INT NOT NULL,
    CONSTRAINT fk_paiement_commande
        FOREIGN KEY (id_commande)
        REFERENCES commande(id_commande)
);

-----SUPPORT & HISTORIQUE // TICKET_SUPPORT
CREATE TABLE ticket_support (
    id_ticket SERIAL PRIMARY KEY,
    sujet VARCHAR(150),
    message TEXT,
    statut VARCHAR(30), -- ouvert, en_cours, ferme
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_ticket_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur)
);

----NOTIFICATION
CREATE TABLE notification (
    id_notification SERIAL PRIMARY KEY,
    type VARCHAR(50), -- securite, facturation, info
    message TEXT,
    lu BOOLEAN DEFAULT FALSE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_notification_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur)
);

----- SESSIONS / AUTHENTICATION
CREATE TABLE session_utilisateur (
    id_session SERIAL PRIMARY KEY,
    token_session VARCHAR(500) UNIQUE NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMP NOT NULL,
    ip_connexion VARCHAR(45),
    user_agent TEXT,
    est_valide BOOLEAN DEFAULT TRUE,
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_session_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

----- API TOKENS
CREATE TABLE api_token (
    id_token SERIAL PRIMARY KEY,
    cle_api VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(100),
    permissions TEXT, -- Scopes séparés par virgule, ex: "read,write"
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dernier_usage TIMESTAMP,
    est_actif BOOLEAN DEFAULT TRUE,
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_api_token_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);
