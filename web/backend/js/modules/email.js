const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(email, firstName) {
  try {
    const result = await resend.emails.send({
      from: 'noreply@cyna.fr',
      to: email,
      subject: 'Bienvenue sur CYNA!',
      html: `
        <h1>Bienvenue ${firstName} 👋</h1>
        <p>Votre compte CYNA a été créé avec succès!</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/index.html">Se connecter à CYNA</a></p>
      `
    });
    console.log('Welcome email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
    const result = await resend.emails.send({
      from: 'noreply@cyna.fr',
      to: email,
      subject: 'Réinitialiser votre mot de passe CYNA',
      html: `
        <h1>Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p><a href="${resetLink}">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien expire dans 24 heures.</p>
      `
    });
    console.log('Password reset email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

async function sendAdminNotification(email, subject, message) {
  try {
    const result = await resend.emails.send({
      from: 'noreply@cyna.fr',
      to: email,
      subject: subject,
      html: `
        <h2>${subject}</h2>
        <p>${message}</p>
      `
    });
    console.log('Admin notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendAdminNotification
};
