const nodemailer = require('nodemailer');

const SMTP_FROM = process.env.SMTP_FROM || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: SMTP_FROM,
      pass: SMTP_PASSWORD,
    },
  });
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#3b12a3;padding:28px;text-align:center;">
      <h1 style="color:#fff;font-size:26px;letter-spacing:4px;margin:0;">CYNA</h1>
      <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:13px;">Cybersécurité managée pour les PME</p>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#bbb;font-size:11px;margin:0;">© 2025 CYNA — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendMail(to, subject, html) {
  if (!SMTP_FROM || !SMTP_PASSWORD) {
    console.warn(`[EMAIL-DEV] SMTP_FROM/SMTP_PASSWORD absents — email non envoyé à ${to}`);
    return;
  }
  const transporter = createTransporter();
  return transporter.sendMail({
    from: `CYNA <${SMTP_FROM}>`,
    to,
    subject,
    html,
  });
}

async function sendWelcomeEmail(email, firstName) {
  const html = baseTemplate(`
    <h2 style="color:#1a1a1a;margin-top:0;">Bienvenue, ${firstName} !</h2>
    <p style="color:#555;line-height:1.6;">
      Votre compte CYNA a été créé avec succès. Vous pouvez dès maintenant accéder à notre plateforme.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${FRONTEND_URL}/index.html"
         style="background:#3b12a3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Accéder à mon espace
      </a>
    </div>
    <p style="color:#aaa;font-size:12px;">Si vous n'avez pas créé ce compte, ignorez cet email.</p>
  `);
  try {
    const result = await sendMail(email, 'Bienvenue sur CYNA !', html);
    console.log('Welcome email sent:', result?.messageId);
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

async function sendVerificationEmail(email, firstName, verificationToken) {
  const verificationLink = `${FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
  const html = baseTemplate(`
    <h2 style="color:#1a1a1a;margin-top:0;">Vérifiez votre adresse email</h2>
    <p style="color:#555;line-height:1.6;">
      Bonjour <strong>${firstName}</strong>, votre compte a été créé avec succès.<br>
      Cliquez sur le bouton ci-dessous pour activer votre compte :
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationLink}"
         style="background:#3b12a3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Vérifier mon email
      </a>
    </div>
    <p style="color:#888;font-size:12px;margin-top:24px;">Ou copiez ce lien :<br>
      <span style="color:#3b12a3;word-break:break-all;">${verificationLink}</span>
    </p>
    <p style="color:#aaa;font-size:12px;margin-top:16px;">Ce lien expire dans <strong>24 heures</strong>.</p>
  `);
  try {
    const result = await sendMail(email, 'Vérifiez votre adresse email CYNA', html);
    console.log('Verification email sent:', result?.messageId);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetLink = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;
  const html = baseTemplate(`
    <h2 style="color:#1a1a1a;margin-top:0;">Réinitialisation du mot de passe</h2>
    <p style="color:#555;line-height:1.6;">Vous avez demandé à réinitialiser votre mot de passe CYNA.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetLink}"
         style="background:#3b12a3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="color:#888;font-size:12px;margin-top:24px;">Ou copiez ce lien :<br>
      <span style="color:#3b12a3;word-break:break-all;">${resetLink}</span>
    </p>
    <p style="color:#888;font-size:13px;">Ce lien expire dans <strong>24 heures</strong>.</p>
    <p style="color:#aaa;font-size:12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  `);
  try {
    const result = await sendMail(email, 'Réinitialiser votre mot de passe CYNA', html);
    console.log('Password reset email sent:', result?.messageId);
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

async function sendAdminNotification(email, subject, message) {
  const html = baseTemplate(`
    <h2 style="color:#1a1a1a;margin-top:0;">${subject}</h2>
    <p style="color:#555;line-height:1.6;">${message}</p>
  `);
  try {
    const result = await sendMail(email, subject, html);
    console.log('Admin notification sent:', result?.messageId);
    return result;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
}

async function sendNewsletterEmail(email, campaignTitle, campaignContent, unsubscribeLink) {
  const html = baseTemplate(`
    <div style="font-family:Arial,sans-serif;">
      ${campaignContent}
      <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
      <p style="font-size:12px;color:#aaa;text-align:center;">
        <a href="${unsubscribeLink}" style="color:#3b12a3;">Se désabonner</a>
      </p>
    </div>
  `);
  try {
    const result = await sendMail(email, campaignTitle, html);
    console.log('Newsletter email sent:', result?.messageId);
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
