-- Script pour créer les tables des catégories et produits
-- À exécuter après add_images_table.sql

-- Table des catégories
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

-- Table des produits
CREATE TABLE IF NOT EXISTS produits (
    id_produit SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description_courte TEXT,
    description_longue TEXT,
    prix DECIMAL(10,2),
    devise VARCHAR(3) DEFAULT 'EUR',
    duree VARCHAR(50) DEFAULT 'mois',
    id_categorie INTEGER REFERENCES categories(id_categorie),
    tag VARCHAR(50), -- Prioritaire, Standard, Premium
    statut VARCHAR(20) DEFAULT 'Disponible', -- Disponible, En rupture, Sur commande
    type_achat VARCHAR(20) DEFAULT 'panier', -- panier, devis
    ordre_affichage INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT TRUE,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur_creation INTEGER REFERENCES utilisateur(id_utilisateur),
    UNIQUE(slug, id_categorie)
);

-- Données d'exemple pour les catégories
INSERT INTO categories (nom, slug, description, icone, couleur, ordre_affichage, actif, id_utilisateur_creation) VALUES
('SOC', 'soc', 'Services de supervision, alerting, dashboard et réponse aux incidents.', 'bi bi-eye', '#351E90', 1, TRUE, 1),
('EDR', 'edr', 'Protection endpoints : détection, réponse, remédiation et visibilité sur les postes/serveurs.', 'bi bi-shield-check', '#5610C0', 2, TRUE, 1),
('XDR', 'xdr', 'Protection unifiée : antivirus, EDR, NDR, SIEM, SOAR et chasse aux menaces.', 'bi bi-diagram-3', '#7602F9', 3, TRUE, 1);

-- Données d'exemple pour les produits SOC
INSERT INTO produits (nom, slug, description_courte, description_longue, prix, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation) VALUES
('Cyna SOC Pro', 'soc-pro', 'Alertes avancées + dashboards personnalisés.', 'Service SOC complet avec alertes avancées, dashboards personnalisés et monitoring continu.', 399.00, 'mois', 1, 'Prioritaire', 'Disponible', 'devis', 1, TRUE, 1),
('Cyna SOC 24/7', 'soc-247', 'Surveillance continue + SLA + support 24/7.', 'Service de surveillance continue avec SLA garanti et support technique 24/7.', 699.00, 'mois', 1, 'Prioritaire', 'Disponible', 'panier', 2, TRUE, 1),
('Cyna SOC Starter', 'soc-starter', 'Pack de démarrage : alertes essentielles + reporting.', 'Pack d''entrée de gamme avec alertes essentielles et reporting automatisé.', 199.00, 'mois', 1, 'Standard', 'Disponible', 'panier', 3, TRUE, 1);

-- Données d'exemple pour les produits EDR
INSERT INTO produits (nom, slug, description_courte, description_longue, prix, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation) VALUES
('Cyna EDR Pro', 'edr-pro', 'Détection avancée + remédiation automatique.', 'Solution EDR avancée avec détection comportementale et remédiation automatique.', 289.00, 'mois', 2, 'Prioritaire', 'Disponible', 'devis', 1, TRUE, 1),
('Cyna EDR Advanced', 'edr-advanced', 'Analyse comportementale + intégrations SOC.', 'EDR avec analyse comportementale avancée et intégrations SOC complètes.', 449.00, 'mois', 2, 'Prioritaire', 'Disponible', 'panier', 2, TRUE, 1),
('Cyna EDR Starter', 'edr-starter', 'Protection essentielle et reporting simple.', 'Protection EDR de base avec reporting simple et interface intuitive.', 149.00, 'mois', 2, 'Standard', 'Disponible', 'panier', 3, TRUE, 1);

-- Données d'exemple pour les produits XDR
INSERT INTO produits (nom, slug, description_courte, description_longue, prix, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation) VALUES
('Cyna XDR Pro', 'xdr-pro', 'Suite complète : EDR + NDR + SIEM + SOAR.', 'Suite XDR complète avec EDR, NDR, SIEM et SOAR intégrés.', 899.00, 'mois', 3, 'Premium', 'Disponible', 'devis', 1, TRUE, 1),
('Cyna XDR Enterprise', 'xdr-enterprise', 'EDR avancé + NDR + visibilité multi-couches.', 'Solution XDR enterprise avec visibilité multi-couches et analytics avancées.', 649.00, 'mois', 3, 'Prioritaire', 'Disponible', 'panier', 2, TRUE, 1),
('Cyna XDR Starter', 'xdr-starter', 'Protection endpoints + visibilité réseau de base.', 'Solution XDR d''entrée avec protection endpoints et visibilité réseau.', 299.00, 'mois', 3, 'Standard', 'Disponible', 'panier', 3, TRUE, 1);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_categories_actif_ordre ON categories(actif, ordre_affichage);
CREATE INDEX IF NOT EXISTS idx_produits_categorie_actif_ordre ON produits(id_categorie, actif, ordre_affichage);
CREATE INDEX IF NOT EXISTS idx_produits_slug ON produits(slug);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);