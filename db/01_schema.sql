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
    statut                VARCHAR(30)  DEFAULT 'actif',   -- actif | inactif | suspendu
    date_creation         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    derniere_connexion    TIMESTAMP,
    id_entreprise         INT          REFERENCES entreprise(id_entreprise),
    -- Email verification
    email_verified        BOOLEAN      DEFAULT FALSE,
    email_verified_at     TIMESTAMP,
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

-- Supprimer l'ancienne colonne role si elle existe encore
ALTER TABLE IF EXISTS utilisateur DROP COLUMN IF EXISTS role;
DROP INDEX IF EXISTS idx_utilisateur_role;


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
    image                  TEXT,
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

-- Ajouter la colonne image si elle n'existe pas (migration idempotente)
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS image TEXT;


-- ============================================================
-- 7. CATALOGUE — Produits (nouvelle table enrichie)
-- ============================================================
CREATE TABLE IF NOT EXISTS produits (
    id_produit              SERIAL PRIMARY KEY,
    nom                     VARCHAR(150) NOT NULL,
    slug                    VARCHAR(150) NOT NULL,
    description_courte      TEXT,
    description_longue      TEXT,
    description_html        TEXT,
    images                  TEXT DEFAULT '[]',
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
    items          JSONB        DEFAULT '[]',
    id_utilisateur INT          NOT NULL REFERENCES utilisateur(id_utilisateur)
);

-- Rétro-compatibilité : ajouter la colonne items si elle n'existe pas encore
ALTER TABLE IF EXISTS commande ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';

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
-- 14. EMAIL VERIFICATION TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id_token              SERIAL PRIMARY KEY,
    email                 VARCHAR(255) NOT NULL,
    token                 VARCHAR(500) UNIQUE NOT NULL,
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    expires_at            TIMESTAMP    NOT NULL,
    used                  BOOLEAN      DEFAULT FALSE,
    used_at               TIMESTAMP,
    id_utilisateur        INT          REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verify_token_email     ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_verify_token_token    ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verify_token_user_id  ON email_verification_tokens(id_utilisateur);


-- ============================================================
-- 15. NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id_subscriber         SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    is_subscribed         BOOLEAN      DEFAULT TRUE,
    subscribed_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at       TIMESTAMP,
    id_utilisateur        INT          REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sub_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_sub_user  ON newsletter_subscribers(id_utilisateur);


-- ============================================================
-- 16. NEWSLETTER CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id_campaign           SERIAL PRIMARY KEY,
    title                 VARCHAR(255) NOT NULL,
    content               TEXT NOT NULL,
    status                VARCHAR(30)  DEFAULT 'draft',  -- draft | sent | scheduled
    created_by            INT          NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    sent_at               TIMESTAMP,
    scheduled_for         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_created_by ON newsletter_campaigns(created_by);


-- ============================================================
-- 17. NEWSLETTER CAMPAIGN SENDS
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_campaign_sends (
    id_send               SERIAL PRIMARY KEY,
    id_campaign           INT          NOT NULL REFERENCES newsletter_campaigns(id_campaign) ON DELETE CASCADE,
    recipient_email       VARCHAR(255) NOT NULL,
    sent_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    status                VARCHAR(30)  DEFAULT 'sent',  -- sent | failed | bounced
    error_message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_campaign ON newsletter_campaign_sends(id_campaign);
CREATE INDEX IF NOT EXISTS idx_newsletter_send_email    ON newsletter_campaign_sends(recipient_email);


-- ============================================================
-- 18. ROLES (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id_role               SERIAL PRIMARY KEY,
    nom                   VARCHAR(100) UNIQUE NOT NULL,
    description           TEXT,
    actif                 BOOLEAN      DEFAULT TRUE,
    is_system_role        BOOLEAN      DEFAULT FALSE,  -- Cannot be deleted if TRUE
    date_creation         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_nom ON roles(nom);


-- ============================================================
-- 19. PERMISSIONS (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
    id_permission         SERIAL PRIMARY KEY,
    code                  VARCHAR(50)  UNIQUE NOT NULL,  -- e.g., "users.view", "users.edit"
    description           TEXT,
    categorie             VARCHAR(50),  -- e.g., "users", "products", "billing", "admin"
    actif                 BOOLEAN      DEFAULT TRUE,
    date_creation         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_categorie ON permissions(categorie);


-- ============================================================
-- 20. ROLE PERMISSIONS (RBAC Junction Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id_role_perm          SERIAL PRIMARY KEY,
    id_role               INT          NOT NULL REFERENCES roles(id_role) ON DELETE CASCADE,
    id_permission         INT          NOT NULL REFERENCES permissions(id_permission) ON DELETE CASCADE,
    UNIQUE(id_role, id_permission)
);

CREATE INDEX IF NOT EXISTS idx_role_perm_role ON role_permissions(id_role);
CREATE INDEX IF NOT EXISTS idx_role_perm_permission ON role_permissions(id_permission);


-- ============================================================
-- 21. USER ROLES (RBAC Junction Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id_user_role          SERIAL PRIMARY KEY,
    id_utilisateur        INT          NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    id_role               INT          NOT NULL REFERENCES roles(id_role) ON DELETE CASCADE,
    date_assignation      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_utilisateur, id_role)
);

CREATE INDEX IF NOT EXISTS idx_user_role_user ON user_roles(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_user_role_role ON user_roles(id_role);

