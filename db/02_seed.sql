
-- ============================================================
-- 13. DONNÉES INITIALES
-- ============================================================

-- Entreprise de démonstration
INSERT INTO entreprise (nom, secteur, taille, pays)
SELECT 'CYNA Demo Corp', 'Cybersecurity', '50-200', 'France'
WHERE NOT EXISTS (SELECT 1 FROM entreprise WHERE nom = 'CYNA Demo Corp');

-- Admin par défaut (mot de passe: Admin1234! - A CHANGER en production)
-- Hash bcrypt valide pour "Admin1234!"
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, statut, email_verified, email_verified_at, id_entreprise)
SELECT 'admin@cyna.fr', '$2a$10$Ib2TDXMV63.0TdWPQWitNu8ZUPU8RwqGuV6FTnBCj8ILhMVLid0dm', 'Admin', 'CYNA', 'actif', TRUE, CURRENT_TIMESTAMP,
       (SELECT id_entreprise FROM entreprise WHERE nom = 'CYNA Demo Corp' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM utilisateur WHERE email = 'admin@cyna.fr');

-- Utilisateur client de test (mot de passe: Admin1234!)
-- Pour simplifier les tests, le hash est identique a celui de l'admin (bcrypt valide)
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, statut, email_verified, email_verified_at, id_entreprise)
SELECT 'user@cyna.fr', '$2a$10$Ib2TDXMV63.0TdWPQWitNu8ZUPU8RwqGuV6FTnBCj8ILhMVLid0dm', 'Durand', 'Alice', 'actif', TRUE, CURRENT_TIMESTAMP,
       (SELECT id_entreprise FROM entreprise WHERE nom = 'CYNA Demo Corp' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM utilisateur WHERE email = 'user@cyna.fr');

-- Token API système (généré automatiquement par l'API Go au démarrage
-- via le bloc "if count == 0" dans main.go — ne pas en insérer un ici)

-- ============================================================
-- Rôles par défaut (RBAC)
-- ============================================================
INSERT INTO roles (id_role, nom, description, actif, is_system_role)
SELECT 1, 'Admin', 'Administrateur système avec tous les droits', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'Admin');

INSERT INTO roles (id_role, nom, description, actif, is_system_role)
SELECT 2, 'Client', 'Utilisateur client standard avec droits de lecture', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'Client');

INSERT INTO roles (id_role, nom, description, actif, is_system_role)
SELECT 3, 'Moderator', 'Modérateur avec droits de modération', TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'Moderator');

INSERT INTO roles (id_role, nom, description, actif, is_system_role)
SELECT 4, 'Support', 'Agent support avec accès limité', TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nom = 'Support');

SELECT setval('roles_id_role_seq', (SELECT MAX(id_role) FROM roles), true);

-- ============================================================
-- Permissions par défaut (RBAC)
-- ============================================================
-- Utilisateurs
INSERT INTO permissions (code, description, categorie, actif)
SELECT 'users.view', 'Consulter les utilisateurs', 'users', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.view');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'users.edit', 'Modifier les utilisateurs', 'users', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.edit');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'users.create', 'Créer des utilisateurs', 'users', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.create');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'users.delete', 'Supprimer des utilisateurs', 'users', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'users.delete');

-- Produits
INSERT INTO permissions (code, description, categorie, actif)
SELECT 'products.view', 'Consulter les produits', 'products', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'products.view');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'products.edit', 'Modifier les produits', 'products', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'products.edit');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'products.create', 'Créer des produits', 'products', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'products.create');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'products.delete', 'Supprimer des produits', 'products', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'products.delete');

-- Newsletter
INSERT INTO permissions (code, description, categorie, actif)
SELECT 'newsletter.view', 'Consulter les abonnés', 'newsletter', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.view');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'newsletter.manage', 'Gérer les campagnes', 'newsletter', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.manage');

INSERT INTO permissions (code, description, categorie, actif)
SELECT 'newsletter.send', 'Envoyer les campagnes', 'newsletter', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'newsletter.send');

-- Rôles et permissions
INSERT INTO permissions (code, description, categorie, actif)
SELECT 'roles.manage', 'Gérer les rôles et permissions', 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'roles.manage');

-- Admin
INSERT INTO permissions (code, description, categorie, actif)
SELECT 'admin.access', 'Accès au panel admin', 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'admin.access');

-- ============================================================
-- Assigner les permissions aux rôles (RBAC)
-- ============================================================
-- Admin: tous les droits
INSERT INTO role_permissions (id_role, id_permission)
SELECT 1, id_permission FROM permissions
ON CONFLICT (id_role, id_permission) DO NOTHING;

-- Client: lecture seule
INSERT INTO role_permissions (id_role, id_permission)
SELECT 2, id_permission FROM permissions WHERE code IN ('users.view', 'products.view')
ON CONFLICT (id_role, id_permission) DO NOTHING;

-- Support: support permissions
INSERT INTO role_permissions (id_role, id_permission)
SELECT 4, id_permission FROM permissions WHERE code IN ('users.view', 'admin.access')
ON CONFLICT (id_role, id_permission) DO NOTHING;

-- Assigner admin au rôle Admin
INSERT INTO user_roles (id_utilisateur, id_role)
SELECT u.id_utilisateur, r.id_role
FROM utilisateur u
JOIN roles r ON r.nom = 'Admin'
WHERE u.email = 'admin@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.id_utilisateur = u.id_utilisateur AND ur.id_role = r.id_role
    );

-- Assigner user au rôle Client
INSERT INTO user_roles (id_utilisateur, id_role)
SELECT u.id_utilisateur, r.id_role
FROM utilisateur u
JOIN roles r ON r.nom = 'Client'
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.id_utilisateur = u.id_utilisateur AND ur.id_role = r.id_role
    );

-- Tokens API de démonstration
INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur)
SELECT 'demo-admin-api-key', 'Demo Admin Key', 'read,write,admin', u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'admin@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM api_token WHERE cle_api = 'demo-admin-api-key');

INSERT INTO api_token (cle_api, nom, permissions, id_utilisateur)
SELECT 'demo-user-api-key', 'Demo User Key', 'read', u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM api_token WHERE cle_api = 'demo-user-api-key');

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

-- Produits (table moderne)
INSERT INTO produits (nom, slug, description_courte, description_longue, prix, devise, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'SOC Essentials', 'soc-essentials',
             'Supervision SOC 24/7 pour PME',
             'Service SOC avec surveillance continue, alertes prioritaires et reporting mensuel.',
             499.00, 'EUR', 'mois', c.id_categorie, 'Standard', 'Disponible', 'panier', 1, TRUE,
             (SELECT id_utilisateur FROM utilisateur WHERE email = 'admin@cyna.fr' LIMIT 1)
FROM categories c
WHERE c.slug = 'soc'
    AND NOT EXISTS (SELECT 1 FROM produits WHERE slug = 'soc-essentials' AND id_categorie = c.id_categorie);

INSERT INTO produits (nom, slug, description_courte, description_longue, prix, devise, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'EDR Pro', 'edr-pro',
             'Protection endpoint avancee',
             'Detection comportementale, remediations automatiques et tableau de bord centralise.',
             19.90, 'EUR', 'mois', c.id_categorie, 'Premium', 'Disponible', 'panier', 2, TRUE,
             (SELECT id_utilisateur FROM utilisateur WHERE email = 'admin@cyna.fr' LIMIT 1)
FROM categories c
WHERE c.slug = 'edr'
    AND NOT EXISTS (SELECT 1 FROM produits WHERE slug = 'edr-pro' AND id_categorie = c.id_categorie);

INSERT INTO produits (nom, slug, description_courte, description_longue, prix, devise, duree, id_categorie, tag, statut, type_achat, ordre_affichage, actif, id_utilisateur_creation)
SELECT 'XDR Enterprise', 'xdr-enterprise',
             'Couverture globale SIEM + SOAR',
             'Offre XDR complete pour ETI et grands comptes avec orchestrations SOAR integrees.',
             2499.00, 'EUR', 'mois', c.id_categorie, 'Prioritaire', 'Disponible', 'devis', 3, TRUE,
             (SELECT id_utilisateur FROM utilisateur WHERE email = 'admin@cyna.fr' LIMIT 1)
FROM categories c
WHERE c.slug = 'xdr'
    AND NOT EXISTS (SELECT 1 FROM produits WHERE slug = 'xdr-enterprise' AND id_categorie = c.id_categorie);

-- Donnees legacy (compatibilite API existante)
INSERT INTO categorie (nom, description, actif)
SELECT 'Protection Endpoint', 'Services EDR et antivirus nouvelle generation', TRUE
WHERE NOT EXISTS (SELECT 1 FROM categorie WHERE nom = 'Protection Endpoint');

INSERT INTO service (nom, description, actif, id_categorie)
SELECT 'EDR Managed', 'Service EDR manage avec supervision', TRUE, c.id_categorie
FROM categorie c
WHERE c.nom = 'Protection Endpoint'
    AND NOT EXISTS (SELECT 1 FROM service WHERE nom = 'EDR Managed');

INSERT INTO produit (nom, description, sur_devis, actif, id_service)
SELECT 'Pack EDR 50 postes', 'Protection et monitoring pour 50 endpoints', FALSE, TRUE, s.id_service
FROM service s
WHERE s.nom = 'EDR Managed'
    AND NOT EXISTS (SELECT 1 FROM produit WHERE nom = 'Pack EDR 50 postes');

INSERT INTO tarification (prix, unite, periodicite, actif, id_produit)
SELECT 990.00, 'licence', 'mensuel', TRUE, p.id_produit
FROM produit p
WHERE p.nom = 'Pack EDR 50 postes'
    AND NOT EXISTS (
            SELECT 1 FROM tarification t
            WHERE t.id_produit = p.id_produit AND t.prix = 990.00 AND t.periodicite = 'mensuel'
    );

-- Commandes, factures et paiements de démonstration
INSERT INTO commande (montant_total, statut, promo_code, items, id_utilisateur)
SELECT 990.00, 'paye', 'WELCOME10',
             '[{"product":"Pack EDR 50 postes","quantity":1,"unit_price":990.00}]'::jsonb,
             u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM commande c
            WHERE c.id_utilisateur = u.id_utilisateur AND c.montant_total = 990.00
    );

INSERT INTO facture (date_facture, montant, lien_pdf, id_commande)
SELECT CURRENT_DATE, c.montant_total, '/invoices/demo-facture-001.pdf', c.id_commande
FROM commande c
JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM facture f WHERE f.id_commande = c.id_commande)
LIMIT 1;

INSERT INTO paiement (moyen, statut, date_paiement, reference_externe, id_commande)
SELECT 'CB', 'success', CURRENT_TIMESTAMP, 'PAY_DEMO_001', c.id_commande
FROM commande c
JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM paiement p
            WHERE p.id_commande = c.id_commande AND p.reference_externe = 'PAY_DEMO_001'
    )
LIMIT 1;

INSERT INTO abonnement (date_debut, date_fin, quantite, statut, renouvellement_auto, id_entreprise, id_produit, id_tarification)
SELECT CURRENT_DATE, CURRENT_DATE + INTERVAL '30 day', 50, 'actif', TRUE,
             e.id_entreprise, p.id_produit, t.id_tarification
FROM entreprise e
JOIN produit p ON p.nom = 'Pack EDR 50 postes'
JOIN tarification t ON t.id_produit = p.id_produit
WHERE e.nom = 'CYNA Demo Corp'
    AND NOT EXISTS (
            SELECT 1 FROM abonnement a
            WHERE a.id_entreprise = e.id_entreprise AND a.id_produit = p.id_produit
    )
LIMIT 1;

-- Support et notifications
INSERT INTO ticket_support (sujet, message, statut, id_utilisateur)
SELECT 'Activation EDR', 'Bonjour, pouvez-vous verifier l''activation sur 3 postes ?', 'ouvert', u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM ticket_support t
            WHERE t.id_utilisateur = u.id_utilisateur AND t.sujet = 'Activation EDR'
    );

INSERT INTO notification (type, message, lu, id_utilisateur)
SELECT 'facturation', 'Votre paiement demo a ete confirme.', FALSE, u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (
            SELECT 1 FROM notification n
            WHERE n.id_utilisateur = u.id_utilisateur AND n.message = 'Votre paiement demo a ete confirme.'
    );

-- Newsletter
INSERT INTO newsletter_subscribers (email, is_subscribed, id_utilisateur)
SELECT 'user@cyna.fr', TRUE, u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
ON CONFLICT (email) DO NOTHING;

INSERT INTO newsletter_campaigns (title, content, status, created_by, sent_at)
SELECT 'Bienvenue chez CYNA', 'Contenu de campagne de test pour valider le module newsletter.', 'sent', u.id_utilisateur, CURRENT_TIMESTAMP
FROM utilisateur u
WHERE u.email = 'admin@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM newsletter_campaigns WHERE title = 'Bienvenue chez CYNA');

INSERT INTO newsletter_campaign_sends (id_campaign, recipient_email, status)
SELECT c.id_campaign, 'user@cyna.fr', 'sent'
FROM newsletter_campaigns c
WHERE c.title = 'Bienvenue chez CYNA'
    AND NOT EXISTS (
            SELECT 1 FROM newsletter_campaign_sends s
            WHERE s.id_campaign = c.id_campaign AND s.recipient_email = 'user@cyna.fr'
    );

-- Tokens de verification email de test
INSERT INTO email_verification_tokens (email, token, expires_at, used, used_at, id_utilisateur)
SELECT 'user@cyna.fr', 'demo-verify-user-token', CURRENT_TIMESTAMP + INTERVAL '7 day', TRUE, CURRENT_TIMESTAMP,
             u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'user@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM email_verification_tokens WHERE token = 'demo-verify-user-token');

INSERT INTO email_verification_tokens (email, token, expires_at, used, id_utilisateur)
SELECT 'admin@cyna.fr', 'demo-verify-admin-token', CURRENT_TIMESTAMP + INTERVAL '7 day', FALSE,
             u.id_utilisateur
FROM utilisateur u
WHERE u.email = 'admin@cyna.fr'
    AND NOT EXISTS (SELECT 1 FROM email_verification_tokens WHERE token = 'demo-verify-admin-token');

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
