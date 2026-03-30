const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWelcomeEmail(email, firstName) {
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
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

async function sendVerificationEmail(email, firstName, verificationToken) {
  try {
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email.html?token=${verificationToken}`;
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Vérifiez votre adresse email CYNA',
      html: `
        <h1>Bienvenue ${firstName} 👋</h1>
        <p>Votre compte CYNA a été créé avec succès!</p>
        <p>Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous:</p>
        <p><a href="${verificationLink}" style="background-color: #351E90; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Vérifier mon email</a></p>
        <p>Ce lien expire dans 24 heures.</p>
        <p>Si vous n'avez pas créé ce compte, ignorez cet email.</p>
      `
    });
    console.log('Verification email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  try {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
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
      from: 'onboarding@resend.dev',
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

async function sendNewsletterEmail(email, campaignTitle, campaignContent, unsubscribeLink) {
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: campaignTitle,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${campaignContent}
          <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            <a href="${unsubscribeLink}" style="color: #351E90;">Se désabonner</a> de cette newsletter
          </p>
        </div>
      `
    });
    console.log('Newsletter email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending newsletter email:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAdminNotification,
  sendNewsletterEmail
};
