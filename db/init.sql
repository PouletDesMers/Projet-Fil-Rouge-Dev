-- =============================================================================
-- CYNA SECURITY PLATFORM — INIT COMPLET DE LA BASE DE DONNÉES
-- Version : 3.0  |  Date : 2026-03-06
-- À exécuter une seule fois sur une DB vierge (idempotent via IF NOT EXISTS)
-- =============================================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. ENTREPRISE
-- ============================================================
CREATE TABLE IF NOT EXISTS entreprise (
    id_entreprise SERIAL PRIMARY KEY,
    nom           VARCHAR(150) NOT NULL,
    secteur       VARCHAR(100),
    taille        VARCHAR(50),
    pays          VARCHAR(50),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 3. UTILISATEUR
-- ============================================================
CREATE TABLE IF NOT EXISTS utilisateur (
    id_utilisateur        SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe          TEXT         NOT NULL,
    nom                   VARCHAR(100),
    prenom                VARCHAR(100),
    telephone             VARCHAR(30),
    role                  VARCHAR(30)  DEFAULT 'client',  -- client | admin | support
    statut                VARCHAR(30)  DEFAULT 'actif',   -- actif | inactif | suspendu
    date_creation         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    derniere_connexion    TIMESTAMP,
    id_entreprise         INT          REFERENCES entreprise(id_entreprise),
    -- 2FA / WebAuthn
    totp_secret           TEXT,
    totp_enabled          BOOLEAN      DEFAULT FALSE,
    webauthn_credential_id TEXT,
    webauthn_public_key   TEXT,
    webauthn_counter      BIGINT       DEFAULT 0,
    -- Sécurité
    tentatives_connexion  INT          DEFAULT 0,
    compte_bloque_jusqu   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_utilisateur_email  ON utilisateur(email);
CREATE INDEX IF NOT EXISTS idx_utilisateur_role   ON utilisateur(role);


-- ============================================================
-- 4. SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS session_utilisateur (
    id_session       SERIAL PRIMARY KEY,
    token_session    VARCHAR(500) UNIQUE NOT NULL,
    date_creation    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    date_expiration  TIMESTAMP    NOT NULL,
    ip_connexion     VARCHAR(45),
    user_agent       TEXT,
    est_valide       BOOLEAN      DEFAULT TRUE,
    id_utilisateur   INT          NOT NULL,
    CONSTRAINT fk_session_utilisateur
        FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_token   ON session_utilisateur(token_session);
CREATE INDEX IF NOT EXISTS idx_session_user    ON session_utilisateur(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_session_expiry  ON session_utilisateur(date_expiration);


-- ============================================================
-- 5. API TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_token (
    id_token         SERIAL PRIMARY KEY,
    cle_api          VARCHAR(255) UNIQUE NOT NULL,
    nom              VARCHAR(100),
    permissions      TEXT         DEFAULT 'read',
    date_creation    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    dernier_usage    TIMESTAMP,
    est_actif        BOOLEAN      DEFAULT TRUE,
    id_utilisateur   INT          NOT NULL,
    CONSTRAINT fk_api_token_utilisateur
        FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);


-- ============================================================
-- 6. CATALOGUE — Catégories (nouvelle table enrichie)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id_categorie           SERIAL PRIMARY KEY,
    nom                    VARCHAR(100) NOT NULL UNIQUE,
    slug                   VARCHAR(100) NOT NULL UNIQUE,
    description            TEXT,
    icone                  VARCHAR(50)  DEFAULT 'bi bi-shield',
    couleur                VARCHAR(7)   DEFAULT '#7602F9',
    ordre_affichage        INT          DEFAULT 0,
    actif                  BOOLEAN      DEFAULT TRUE,
    date_creation          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    date_modification      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INT         REFERENCES utilisateur(id_utilisateur)
);

CREATE INDEX IF NOT EXISTS idx_categories_slug         ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_actif_ordre  ON categories(actif, ordre_affichage);


-- ============================================================
-- 7. CATALOGUE — Produits (nouvelle table enrichie)
-- ============================================================
CREATE TABLE IF NOT EXISTS produits (
    id_produit              SERIAL PRIMARY KEY,
    nom                     VARCHAR(150) NOT NULL,
    slug                    VARCHAR(150) NOT NULL,
    description_courte      TEXT,
    description_longue      TEXT,
    prix                    DECIMAL(10,2),
    devise                  VARCHAR(3)   DEFAULT 'EUR',
    duree                   VARCHAR(50)  DEFAULT 'mois',
    id_categorie            INT          REFERENCES categories(id_categorie),
    tag                     VARCHAR(50),                   -- Prioritaire | Standard | Premium
    statut                  VARCHAR(20)  DEFAULT 'Disponible',
    type_achat              VARCHAR(20)  DEFAULT 'panier', -- panier | devis
    ordre_affichage         INT          DEFAULT 0,
    actif                   BOOLEAN      DEFAULT TRUE,
    date_creation           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    date_modification       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INT          REFERENCES utilisateur(id_utilisateur),
    UNIQUE(slug, id_categorie)
);

CREATE INDEX IF NOT EXISTS idx_produits_slug              ON produits(slug);
CREATE INDEX IF NOT EXISTS idx_produits_categorie         ON produits(id_categorie);
CREATE INDEX IF NOT EXISTS idx_produits_categorie_actif   ON produits(id_categorie, actif, ordre_affichage);


-- ============================================================
-- 8. CATALOGUE — Tables legacy (compatibilité API existante)
-- ============================================================
CREATE TABLE IF NOT EXISTS categorie (
    id_categorie  SERIAL PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL,
    description   TEXT,
    actif         BOOLEAN      DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS service (
    id_service    SERIAL PRIMARY KEY,
    nom           VARCHAR(50)  NOT NULL,
    description   TEXT,
    actif         BOOLEAN      DEFAULT TRUE,
    id_categorie  INT          NOT NULL REFERENCES categorie(id_categorie)
);

CREATE TABLE IF NOT EXISTS produit (
    id_produit    SERIAL PRIMARY KEY,
    nom           VARCHAR(150) NOT NULL,
    description   TEXT,
    sur_devis     BOOLEAN      DEFAULT FALSE,
    actif         BOOLEAN      DEFAULT TRUE,
    id_service    INT          NOT NULL REFERENCES service(id_service)
);

CREATE TABLE IF NOT EXISTS tarification (
    id_tarification SERIAL PRIMARY KEY,
    prix            NUMERIC(10,2),
    unite           VARCHAR(30),
    periodicite     VARCHAR(20),
    actif           BOOLEAN      DEFAULT TRUE,
    id_produit      INT          NOT NULL REFERENCES produit(id_produit)
);


-- ============================================================
-- 9. ABONNEMENTS & COMMANDES
-- ============================================================
CREATE TABLE IF NOT EXISTS abonnement (
    id_abonnement       SERIAL PRIMARY KEY,
    date_debut          DATE         NOT NULL,
    date_fin            DATE,
    quantite            INT,
    statut              VARCHAR(30),           -- actif | suspendu | resilie
    renouvellement_auto BOOLEAN      DEFAULT TRUE,
    id_entreprise       INT          NOT NULL REFERENCES entreprise(id_entreprise),
    id_produit          INT          NOT NULL REFERENCES produit(id_produit),
    id_tarification     INT          NOT NULL REFERENCES tarification(id_tarification)
);

CREATE TABLE IF NOT EXISTS commande (
    id_commande    SERIAL PRIMARY KEY,
    date_commande  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    montant_total  NUMERIC(10,2),
    statut         VARCHAR(30),               -- paye | echec | attente
    promo_code     TEXT,
    id_utilisateur INT          NOT NULL REFERENCES utilisateur(id_utilisateur)
);

CREATE TABLE IF NOT EXISTS facture (
    id_facture   SERIAL PRIMARY KEY,
    date_facture DATE,
    montant      NUMERIC(10,2),
    lien_pdf     TEXT,
    id_commande  INT UNIQUE    NOT NULL REFERENCES commande(id_commande)
);

CREATE TABLE IF NOT EXISTS paiement (
    id_paiement         SERIAL PRIMARY KEY,
    moyen               VARCHAR(50),           -- CB | PayPal
    statut              VARCHAR(30),
    date_paiement       TIMESTAMP,
    reference_externe   VARCHAR(150),
    id_commande         INT          NOT NULL REFERENCES commande(id_commande)
);


-- ============================================================
-- 10. SUPPORT & NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_support (
    id_ticket       SERIAL PRIMARY KEY,
    sujet           VARCHAR(150),
    message         TEXT,
    statut          VARCHAR(30)  DEFAULT 'ouvert', -- ouvert | en_cours | ferme
    date_creation   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur  INT          NOT NULL REFERENCES utilisateur(id_utilisateur)
);

CREATE TABLE IF NOT EXISTS notification (
    id_notification SERIAL PRIMARY KEY,
    type            VARCHAR(50),               -- securite | facturation | info
    message         TEXT,
    lu              BOOLEAN      DEFAULT FALSE,
    date_creation   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur  INT          NOT NULL REFERENCES utilisateur(id_utilisateur)
);


-- ============================================================
-- 11. IMAGES CAROUSEL
-- ============================================================
CREATE TABLE IF NOT EXISTS carousel_images (
    id_image                SERIAL PRIMARY KEY,
    titre                   VARCHAR(255) NOT NULL,
    description             TEXT,
    url_image               VARCHAR(500) NOT NULL,
    alt_text                VARCHAR(255),
    ordre_affichage         INT          DEFAULT 1,
    actif                   BOOLEAN      DEFAULT TRUE,
    date_creation           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    date_modification       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INT          REFERENCES utilisateur(id_utilisateur)
);

CREATE INDEX IF NOT EXISTS idx_carousel_images_ordre ON carousel_images(ordre_affichage);


-- ============================================================
-- 12. LOGS API (persistance PostgreSQL, remplace le buffer RAM)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_logs (
    id          BIGSERIAL    PRIMARY KEY,
    timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    level       VARCHAR(16)  NOT NULL DEFAULT 'INFO',
    message     TEXT         NOT NULL DEFAULT '',
    method      VARCHAR(10)  NOT NULL DEFAULT '',
    path        TEXT         NOT NULL DEFAULT '',
    ip          VARCHAR(64)  NOT NULL DEFAULT '',
    user_id     INT          NULL,
    status      INT          NOT NULL DEFAULT 0,
    duration_ms INT          NOT NULL DEFAULT 0
);

-- ~153 bytes/ligne → 1 million de lignes ≈ 146 MB (données) + ~50 MB (index) = ~200 MB
-- Purge auto des entrées > 90 jours gérée par initLogDB() au démarrage de l'API

CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_level     ON api_logs (level);
CREATE INDEX IF NOT EXISTS idx_api_logs_status    ON api_logs (status);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id   ON api_logs (user_id) WHERE user_id IS NOT NULL;


-- ============================================================
-- 13. DONNÉES INITIALES
-- ============================================================

-- Admin par défaut (mot de passe : Admin1234! — À CHANGER en production)
-- Hash bcrypt généré pour "Admin1234!"
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, role, statut)
SELECT 'admin@cyna.fr', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHuy', 'Admin', 'CYNA', 'admin', 'actif'
WHERE NOT EXISTS (SELECT 1 FROM utilisateur WHERE email = 'admin@cyna.fr');

-- Token API système (généré automatiquement par l'API Go au premier démarrage
-- via le bloc "if count == 0" dans main.go — ne pas en insérer un ici)

-- Catégories de démonstration
INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'SOC', 'soc', 'Services de supervision, alerting, dashboard et réponse aux incidents.', 'bi bi-eye', '#351E90', 1, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'soc');

INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'EDR', 'edr', 'Protection endpoints : détection, réponse, remédiation et visibilité.', 'bi bi-shield-check', '#5610C0', 2, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'edr');

INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'XDR', 'xdr', 'Protection unifiée : antivirus, EDR, NDR, SIEM, SOAR et chasse aux menaces.', 'bi bi-diagram-3', '#7602F9', 3, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'xdr');

-- Images carousel par défaut
INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, id_utilisateur_creation)
SELECT 'Advanced Endpoint Protection', 'Protection avancée des terminaux avec IA',
       'https://placehold.co/1200x360/351E90/FFFFFF?text=Advanced+Endpoint+Protection',
       'Protection des terminaux', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM carousel_images WHERE ordre_affichage = 1);

INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, id_utilisateur_creation)
SELECT 'Global SOC Monitoring', 'Surveillance 24/7 par notre SOC global',
       'https://placehold.co/1200x360/5610C0/FFFFFF?text=Global+SOC+Monitoring',
       'Monitoring SOC', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM carousel_images WHERE ordre_affichage = 2);

INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, id_utilisateur_creation)
SELECT '24/7 Security Assistance', 'Assistance sécurité disponible en permanence',
       'https://placehold.co/1200x360/7602F9/FFFFFF?text=24/7+Security+Assistance',
       'Assistance sécurité', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM carousel_images WHERE ordre_affichage = 3);
