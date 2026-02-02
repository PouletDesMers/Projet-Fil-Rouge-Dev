-- Fix user table columns if missing
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS webauthn_credential_id TEXT;
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS webauthn_public_key TEXT;
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS webauthn_counter BIGINT DEFAULT 0;

-- Create session table if missing
CREATE TABLE IF NOT EXISTS session_utilisateur (
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

-- Create API token table if missing
CREATE TABLE IF NOT EXISTS api_token (
    id_token SERIAL PRIMARY KEY,
    cle_api VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(100),
    permissions TEXT,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dernier_usage TIMESTAMP,
    est_actif BOOLEAN DEFAULT TRUE,
    id_utilisateur INT NOT NULL,
    CONSTRAINT fk_api_token_utilisateur
        FOREIGN KEY (id_utilisateur)
        REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);
