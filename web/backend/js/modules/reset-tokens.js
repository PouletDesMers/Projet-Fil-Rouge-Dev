const crypto = require('crypto');

// Stockage en mémoire des tokens (en prod, utiliser Redis ou la DB)
const resetTokens = new Map();

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function saveResetToken(email, token, expiresIn = 24 * 60 * 60 * 1000) {
  const expiresAt = Date.now() + expiresIn;
  resetTokens.set(token, {
    email,
    expiresAt,
    used: false
  });

  // Nettoyer les vieux tokens
  for (const [key, value] of resetTokens.entries()) {
    if (value.expiresAt < Date.now()) {
      resetTokens.delete(key);
    }
  }

  return token;
}

function validateResetToken(token) {
  const data = resetTokens.get(token);

  if (!data) {
    return { valid: false, error: 'Token invalide ou expiré' };
  }

  if (data.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return { valid: false, error: 'Token expiré' };
  }

  if (data.used) {
    return { valid: false, error: 'Token déjà utilisé' };
  }

  return { valid: true, email: data.email };
}

function markTokenAsUsed(token) {
  const data = resetTokens.get(token);
  if (data) {
    data.used = true;
  }
}

module.exports = {
  generateResetToken,
  saveResetToken,
  validateResetToken,
  markTokenAsUsed
};
