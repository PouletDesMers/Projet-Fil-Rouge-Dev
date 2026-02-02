-- Table pour gérer les images du carrousel dynamiquement
CREATE TABLE carousel_images (
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
        REFERENCES utilisateur(id_utilisateur)
);

-- Index pour l'ordre d'affichage
CREATE INDEX idx_carousel_images_ordre ON carousel_images(ordre_affichage);

-- Données d'exemple
INSERT INTO carousel_images (titre, description, url_image, alt_text, ordre_affichage, id_utilisateur_creation) VALUES
('Advanced Endpoint Protection', 'Protection avancée des terminaux avec IA', 'https://placehold.co/1200x360/351E90/FFFFFF?text=Advanced+Endpoint+Protection', 'Protection des terminaux', 1, 1),
('Global SOC Monitoring', 'Surveillance 24/7 par notre SOC global', 'https://placehold.co/1200x360/5610C0/FFFFFF?text=Global+SOC+Monitoring', 'Monitoring SOC', 2, 1),
('24/7 Security Assistance', 'Assistance sécurité disponible en permanence', 'https://placehold.co/1200x360/7602F9/FFFFFF?text=24/7+Security+Assistance', 'Assistance sécurité', 3, 1);