-- Ajouter les colonnes manquantes pour WebAuthn dans la table utilisateur
ALTER TABLE utilisateur
ADD COLUMN webauthn_credential_id TEXT,
ADD COLUMN webauthn_public_key TEXT,
ADD COLUMN webauthn_counter INTEGER;