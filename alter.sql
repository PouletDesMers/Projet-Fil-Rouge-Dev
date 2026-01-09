ALTER TABLE utilisateur ADD COLUMN totp_secret TEXT;
ALTER TABLE utilisateur ADD COLUMN webauthn_credential_id TEXT;
ALTER TABLE utilisateur ADD COLUMN webauthn_public_key TEXT;
ALTER TABLE utilisateur ADD COLUMN webauthn_counter BIGINT DEFAULT 0;