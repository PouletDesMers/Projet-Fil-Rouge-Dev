-- =============================================================================
-- CYNA SECURITY PLATFORM - BASE DE DONNÉES COMPLÈTE
-- Version: 2.0
-- Date: 2026-02-02
-- Description: Schema complet pour la plateforme de sécurité Cyna
-- =============================================================================

-- ===============================
-- EXTENSIONS POSTGRES
-- ===============================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================
-- TABLE DES UTILISATEURS  
-- ===============================
CREATE TABLE IF NOT EXISTS utilisateur (
    id_utilisateur SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('admin', 'client', 'gestionnaire')),
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
    id_entreprise INT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    derniere_connexion TIMESTAMP,
    
    -- 2FA et WebAuthn
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT FALSE,
    webauthn_credential_id TEXT,
    webauthn_public_key TEXT,
    webauthn_counter BIGINT DEFAULT 0,
    
    -- Sécurité
    tentatives_connexion INT DEFAULT 0,
    compte_bloque_jusqu TIMESTAMP,
    
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_telephone_format CHECK (telephone IS NULL OR telephone ~* '^\+?[0-9\s\-\(\)]{8,20}$')
);

-- ===============================
-- TABLES DE SÉCURITÉ
-- ===============================

-- Sessions utilisateur sécurisées
CREATE TABLE IF NOT EXISTS session_utilisateur (
    id_session SERIAL PRIMARY KEY,
    token_session VARCHAR(500) UNIQUE NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMP NOT NULL,
    ip_connexion INET,
    user_agent TEXT,
    est_valide BOOLEAN DEFAULT TRUE,
    id_utilisateur INT NOT NULL,
    
    CONSTRAINT fk_session_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

-- Clés API pour accès programmatique
CREATE TABLE IF NOT EXISTS api_token (
    id_token SERIAL PRIMARY KEY,
    cle_api VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    permissions TEXT DEFAULT 'read',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dernier_usage TIMESTAMP,
    est_actif BOOLEAN DEFAULT TRUE,
    id_utilisateur INT NOT NULL,
    
    -- Restrictions de sécurité
    ip_autorisees TEXT[], -- Liste des IPs autorisées
    limite_requetes_jour INT DEFAULT 1000,
    requetes_utilisees_aujourd_hui INT DEFAULT 0,
    derniere_reset_compteur DATE DEFAULT CURRENT_DATE,
    
    CONSTRAINT fk_api_token_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    CONSTRAINT chk_permissions CHECK (permissions IN ('read', 'write', 'admin'))
);

-- Logs de sécurité
CREATE TABLE IF NOT EXISTS security_log (
    id_log SERIAL PRIMARY KEY,
    type_evenement VARCHAR(50) NOT NULL,
    ip_source INET,
    user_agent TEXT,
    id_utilisateur INT,
    details JSONB,
    niveau_securite VARCHAR(20) DEFAULT 'INFO' CHECK (niveau_securite IN ('INFO', 'WARNING', 'CRITICAL')),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_security_log_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL
);

-- ===============================
-- ENTREPRISES ET ORGANISATIONS
-- ===============================
CREATE TABLE IF NOT EXISTS entreprise (
    id_entreprise SERIAL PRIMARY KEY,
    nom VARCHAR(200) NOT NULL,
    secteur_activite VARCHAR(100),
    taille VARCHAR(20) CHECK (taille IN ('TPE', 'PME', 'ETI', 'GE')),
    siret VARCHAR(14),
    adresse TEXT,
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    pays VARCHAR(50) DEFAULT 'France',
    telephone VARCHAR(20),
    email VARCHAR(255),
    site_web VARCHAR(255),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actif BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT chk_entreprise_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ===============================
-- CATALOGUE DE SERVICES
-- ===============================

-- Catégories de services
CREATE TABLE IF NOT EXISTS categories (
    id_categorie SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icone VARCHAR(50), -- Classe d'icône (ex: 'bi bi-shield')
    couleur VARCHAR(7) DEFAULT '#7602F9', -- Couleur hexadécimale
    ordre_affichage INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INTEGER REFERENCES utilisateur(id_utilisateur)
);

-- Services/Produits
CREATE TABLE IF NOT EXISTS produits (
    id_produit SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description_courte TEXT,
    description_longue TEXT,
    prix DECIMAL(10,2),
    devise VARCHAR(3) DEFAULT 'EUR',
    duree VARCHAR(50) DEFAULT 'mois',
    id_categorie INTEGER REFERENCES categories(id_categorie),
    tag VARCHAR(50), -- Prioritaire, Standard, Premium
    tag_couleur VARCHAR(7) DEFAULT '#28a745',
    icone VARCHAR(50),
    ordre_affichage INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    populaire BOOLEAN DEFAULT FALSE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INTEGER REFERENCES utilisateur(id_utilisateur),
    
    CONSTRAINT chk_prix_positif CHECK (prix IS NULL OR prix >= 0),
    CONSTRAINT chk_tag_valide CHECK (tag IS NULL OR tag IN ('Prioritaire', 'Standard', 'Premium', 'Nouveau'))
);

-- Tarifications
CREATE TABLE IF NOT EXISTS tarification (
    id_tarification SERIAL PRIMARY KEY,
    prix DECIMAL(10,2) NOT NULL,
    unite VARCHAR(50) DEFAULT 'utilisateur',
    periodicite VARCHAR(20) DEFAULT 'mensuel' CHECK (periodicite IN ('mensuel', 'annuel', 'unique')),
    actif BOOLEAN DEFAULT TRUE,
    id_produit INT NOT NULL,
    
    CONSTRAINT fk_tarification_produit
        FOREIGN KEY (id_produit)
        REFERENCES produits(id_produit) ON DELETE CASCADE,
    CONSTRAINT chk_prix_tarif_positif CHECK (prix > 0)
);

-- ===============================
-- GESTION DES MÉDIAS
-- ===============================

-- Images du carrousel
CREATE TABLE IF NOT EXISTS carousel_images (
    id_image SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    url_image VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    ordre_affichage INTEGER DEFAULT 1,
    actif BOOLEAN DEFAULT TRUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INT,
    
    CONSTRAINT fk_carousel_images_utilisateur
        FOREIGN KEY (id_utilisateur_creation)
        REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL
);

-- ===============================
-- GESTION COMMERCIALE
-- ===============================

-- Abonnements
CREATE TABLE IF NOT EXISTS abonnement (
    id_abonnement SERIAL PRIMARY KEY,
    id_utilisateur INT NOT NULL,
    id_produit INT NOT NULL,
    date_debut TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_fin TIMESTAMP,
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'resilie', 'expire')),
    prix_mensuel DECIMAL(10,2),
    devise VARCHAR(3) DEFAULT 'EUR',
    
    CONSTRAINT fk_abonnement_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
    CONSTRAINT fk_abonnement_produit
        FOREIGN KEY (id_produit)
        REFERENCES produits(id_produit)
);

-- Commandes
CREATE TABLE IF NOT EXISTS commande (
    id_commande SERIAL PRIMARY KEY,
    numero_commande VARCHAR(50) UNIQUE NOT NULL,
    id_utilisateur INT NOT NULL,
    montant_total DECIMAL(10,2) NOT NULL,
    devise VARCHAR(3) DEFAULT 'EUR',
    statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'confirmee', 'annulee', 'remboursee')),
    date_commande TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_commande_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur)
);

-- Factures
CREATE TABLE IF NOT EXISTS facture (
    id_facture SERIAL PRIMARY KEY,
    numero_facture VARCHAR(50) UNIQUE NOT NULL,
    id_commande INT,
    montant DECIMAL(10,2) NOT NULL,
    devise VARCHAR(3) DEFAULT 'EUR',
    statut VARCHAR(20) DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'annulee')),
    date_emission DATE DEFAULT CURRENT_DATE,
    date_echeance DATE,
    
    CONSTRAINT fk_facture_commande
        FOREIGN KEY (id_commande)
        REFERENCES commande(id_commande)
);

-- Paiements
CREATE TABLE IF NOT EXISTS paiement (
    id_paiement SERIAL PRIMARY KEY,
    id_facture INT NOT NULL,
    montant DECIMAL(10,2) NOT NULL,
    devise VARCHAR(3) DEFAULT 'EUR',
    methode_paiement VARCHAR(50) NOT NULL,
    reference_externe VARCHAR(255),
    statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'reussi', 'echec', 'rembourse')),
    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_paiement_facture
        FOREIGN KEY (id_facture)
        REFERENCES facture(id_facture)
);

-- ===============================
-- SUPPORT CLIENT
-- ===============================

-- Tickets de support
CREATE TABLE IF NOT EXISTS ticket_support (
    id_ticket SERIAL PRIMARY KEY,
    numero_ticket VARCHAR(50) UNIQUE NOT NULL,
    id_utilisateur INT NOT NULL,
    sujet VARCHAR(255) NOT NULL,
    description TEXT,
    priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'critique')),
    statut VARCHAR(20) DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'resolu', 'ferme')),
    id_assignee INT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_resolution TIMESTAMP,
    
    CONSTRAINT fk_ticket_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur),
    CONSTRAINT fk_ticket_assignee
        FOREIGN KEY (id_assignee)
        REFERENCES utilisateur(id_utilisateur)
);

-- Notifications système
CREATE TABLE IF NOT EXISTS notification (
    id_notification SERIAL PRIMARY KEY,
    id_utilisateur INT NOT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    lu BOOLEAN DEFAULT FALSE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

-- ===============================
-- INDEX POUR PERFORMANCES
-- ===============================

-- Index utilisateur
CREATE INDEX IF NOT EXISTS idx_utilisateur_email ON utilisateur(email);
CREATE INDEX IF NOT EXISTS idx_utilisateur_role ON utilisateur(role);
CREATE INDEX IF NOT EXISTS idx_utilisateur_statut ON utilisateur(statut);

-- Index sessions
CREATE INDEX IF NOT EXISTS idx_session_token ON session_utilisateur(token_session);
CREATE INDEX IF NOT EXISTS idx_session_user_valid ON session_utilisateur(id_utilisateur, est_valide);
CREATE INDEX IF NOT EXISTS idx_session_expiration ON session_utilisateur(date_expiration);

-- Index API tokens
CREATE INDEX IF NOT EXISTS idx_api_token_key ON api_token(cle_api);
CREATE INDEX IF NOT EXISTS idx_api_token_user ON api_token(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_api_token_actif ON api_token(est_actif);

-- Index sécurité
CREATE INDEX IF NOT EXISTS idx_security_log_date ON security_log(date_creation);
CREATE INDEX IF NOT EXISTS idx_security_log_type ON security_log(type_evenement);
CREATE INDEX IF NOT EXISTS idx_security_log_niveau ON security_log(niveau_securite);

-- Index catalogue
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_actif ON categories(actif);
CREATE INDEX IF NOT EXISTS idx_produits_slug ON produits(slug);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(id_categorie);
CREATE INDEX IF NOT EXISTS idx_produits_actif ON produits(actif);

-- Index images
CREATE INDEX IF NOT EXISTS idx_carousel_images_ordre ON carousel_images(ordre_affichage);
CREATE INDEX IF NOT EXISTS idx_carousel_images_actif ON carousel_images(actif);

-- ===============================
-- CONTRAINTES RÉFÉRENTIELLES
-- ===============================

-- Ajouter FK entreprise après création
ALTER TABLE utilisateur ADD CONSTRAINT fk_utilisateur_entreprise
    FOREIGN KEY (id_entreprise) REFERENCES entreprise(id_entreprise);

-- ===============================
-- FONCTIONS UTILES
-- ===============================

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM session_utilisateur 
    WHERE date_expiration < NOW() OR est_valide = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO security_log (type_evenement, details, niveau_securite)
    VALUES ('SESSION_CLEANUP', json_build_object('deleted_sessions', deleted_count), 'INFO');
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour réinitialiser le compteur de requêtes API
CREATE OR REPLACE FUNCTION reset_api_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE api_token 
    SET requetes_utilisees_aujourd_hui = 0,
        derniere_reset_compteur = CURRENT_DATE
    WHERE derniere_reset_compteur < CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================
-- TRIGGERS DE SÉCURITÉ
-- ===============================

-- Trigger pour loger les connexions
CREATE OR REPLACE FUNCTION log_user_login()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO security_log (type_evenement, id_utilisateur, details, niveau_securite)
    VALUES ('USER_LOGIN', NEW.id_utilisateur, 
            json_build_object('ip', NEW.ip_connexion, 'user_agent', NEW.user_agent), 
            'INFO');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_user_login
    AFTER INSERT ON session_utilisateur
    FOR EACH ROW EXECUTE FUNCTION log_user_login();

-- ===============================
-- DONNÉES INITIALES
-- ===============================

-- Utilisateur admin par défaut
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, role, statut)
VALUES ('admin@cyna.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'System', 'admin', 'actif')
ON CONFLICT (email) DO NOTHING;

-- Catégories par défaut
INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage) VALUES
('Sécurité des Terminaux', 'securite-terminaux', 'Protection avancée pour tous vos appareils', 'bi bi-shield-check', '#FF6B6B', 1),
('Surveillance Réseau', 'surveillance-reseau', 'Monitoring 24/7 de votre infrastructure', 'bi bi-diagram-3', '#4ECDC4', 2),
('Formation Sécurité', 'formation-securite', 'Sensibilisation et formation cybersécurité', 'bi bi-mortarboard', '#45B7D1', 3),
('Audit & Conformité', 'audit-conformite', 'Audits de sécurité et mise en conformité', 'bi bi-clipboard-check', '#96CEB4', 4)
ON CONFLICT (slug) DO NOTHING;

-- Images carrousel par défaut  
INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, id_utilisateur_creation) VALUES
('Protection Avancée des Terminaux', 'Sécurité multicouche avec IA pour vos appareils', 'https://placehold.co/1200x400/FF6B6B/FFFFFF?text=Protection+Terminaux', 'Protection terminaux', 1, 1),
('Surveillance 24/7', 'Monitoring continu par notre SOC certifié', 'https://placehold.co/1200x400/4ECDC4/FFFFFF?text=Surveillance+24/7', 'Surveillance réseau', 2, 1),
('Formation Cybersécurité', 'Sensibilisation de vos équipes aux menaces', 'https://placehold.co/1200x400/45B7D1/FFFFFF?text=Formation+Cyber', 'Formation sécurité', 3, 1)
ON CONFLICT DO NOTHING;

-- ===============================
-- CONFIGURATION SÉCURISÉE
-- ===============================

-- Activer les logs de connexions
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_failed_authentication = 'on';

-- Configuration SSL
ALTER SYSTEM SET ssl = 'on';

-- Limites de connexions
ALTER SYSTEM SET max_connections = '200';

-- ===============================
-- VUES UTILES
-- ===============================

-- Vue des utilisateurs actifs avec statistiques
CREATE OR REPLACE VIEW utilisateurs_actifs AS
SELECT 
    u.id_utilisateur,
    u.email,
    u.nom,
    u.prenom,
    u.role,
    u.date_creation,
    u.derniere_connexion,
    u.totp_enabled,
    COUNT(s.id_session) as sessions_actives,
    COUNT(a.id_token) as api_tokens_actifs,
    e.nom as entreprise
FROM utilisateur u
LEFT JOIN session_utilisateur s ON u.id_utilisateur = s.id_utilisateur AND s.est_valide = TRUE
LEFT JOIN api_token a ON u.id_utilisateur = a.id_utilisateur AND a.est_actif = TRUE  
LEFT JOIN entreprise e ON u.id_entreprise = e.id_entreprise
WHERE u.statut = 'actif'
GROUP BY u.id_utilisateur, e.nom;

-- Vue du catalogue public
CREATE OR REPLACE VIEW catalogue_public AS
SELECT 
    p.id_produit,
    p.nom,
    p.slug,
    p.description_courte,
    p.prix,
    p.devise,
    p.duree,
    p.tag,
    p.tag_couleur,
    p.icone,
    p.populaire,
    c.nom as categorie,
    c.slug as categorie_slug,
    c.icone as categorie_icone,
    c.couleur as categorie_couleur
FROM produits p
JOIN categories c ON p.id_categorie = c.id_categorie
WHERE p.actif = TRUE AND c.actif = TRUE
ORDER BY p.ordre_affichage, p.nom;

-- ===============================
-- FIN DU SCRIPT
-- ===============================
-- Base de données Cyna Security Platform créée avec succès !
-- N'oubliez pas de :
-- 1. Changer le mot de passe admin par défaut
-- 2. Configurer SSL en production  
-- 3. Mettre en place des sauvegardes régulières
-- 4. Surveiller les logs de sécurité
-- =============================================================================