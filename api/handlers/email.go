package handlers

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
)

// sendEmail envoie un email HTML via Gmail SMTP (port 587 / STARTTLS).
// Si SMTP_FROM ou SMTP_PASSWORD est absent, log un avertissement et retourne nil.
func sendEmail(to, subject, html string) error {
	from := os.Getenv("SMTP_FROM")
	password := os.Getenv("SMTP_PASSWORD")

	if from == "" || password == "" {
		log.Printf("[EMAIL-DEV] SMTP_FROM/SMTP_PASSWORD absents — email non envoyé à %s | sujet: %s", to, subject)
		return nil
	}

	host := "smtp.gmail.com"
	msg := "From: CYNA <" + from + ">\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n" +
		"\r\n" + html

	auth := smtp.PlainAuth("", from, password, host)
	if err := smtp.SendMail(host+":587", auth, from, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("smtp: %w", err)
	}
	return nil
}

// sendEmailWelcome envoie un email de bienvenue après inscription mobile (email déjà vérifié).
func sendEmailWelcome(to, firstName string) {
	subject := "Bienvenue sur CYNA !"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#3b12a3;padding:28px;text-align:center;">
      <h1 style="color:#fff;font-size:26px;letter-spacing:4px;margin:0;">CYNA</h1>
      <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:13px;">Cybersécurité managée pour les PME</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1a1a1a;margin-top:0;">Bienvenue, %s !</h2>
      <p style="color:#555;line-height:1.6;">Votre compte CYNA a été créé avec succès. Vous pouvez dès maintenant accéder à nos services de cybersécurité managée.</p>
      <div style="background:#f0ecff;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <p style="color:#3b12a3;font-weight:700;margin:0;font-size:15px;">Votre compte est actif</p>
      </div>
      <p style="color:#aaa;font-size:12px;">Si vous n'avez pas créé ce compte, contactez-nous immédiatement.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#bbb;font-size:11px;margin:0;">© 2025 CYNA — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`, firstName)

	if err := sendEmail(to, subject, html); err != nil {
		log.Printf("[EMAIL] Erreur envoi bienvenue à %s: %v", to, err)
	}
}

// sendEmailPasswordReset envoie le code OTP de réinitialisation de mot de passe.
func sendEmailPasswordReset(to, code string) {
	subject := "Code de réinitialisation CYNA"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#3b12a3;padding:28px;text-align:center;">
      <h1 style="color:#fff;font-size:26px;letter-spacing:4px;margin:0;">CYNA</h1>
      <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:13px;">Cybersécurité managée pour les PME</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1a1a1a;margin-top:0;">Réinitialisation du mot de passe</h2>
      <p style="color:#555;line-height:1.6;">Votre code de réinitialisation est :</p>
      <div style="background:#f0ecff;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#3b12a3;">%s</span>
      </div>
      <p style="color:#888;font-size:13px;">Ce code expire dans <strong>10 minutes</strong>.</p>
      <p style="color:#888;font-size:13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#bbb;font-size:11px;margin:0;">© 2025 CYNA — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`, code)

	if err := sendEmail(to, subject, html); err != nil {
		log.Printf("[EMAIL] Erreur envoi reset à %s: %v", to, err)
	}
}

// sendEmailVerification envoie le lien de vérification de compte.
func sendEmailVerification(to, firstName, token string) {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	verifyLink := frontendURL + "/verify-email.html?token=" + token

	subject := "Vérifiez votre adresse email CYNA"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#3b12a3;padding:28px;text-align:center;">
      <h1 style="color:#fff;font-size:26px;letter-spacing:4px;margin:0;">CYNA</h1>
      <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:13px;">Cybersécurité managée pour les PME</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1a1a1a;margin-top:0;">Bienvenue, %s !</h2>
      <p style="color:#555;line-height:1.6;">Votre compte CYNA a été créé avec succès. Cliquez sur le bouton ci-dessous pour activer votre compte :</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="%s"
           style="background:#3b12a3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          Vérifier mon email
        </a>
      </div>
      <p style="color:#888;font-size:12px;margin-top:24px;">Ou copiez ce lien dans votre navigateur :<br>
        <span style="color:#3b12a3;word-break:break-all;">%s</span>
      </p>
      <p style="color:#aaa;font-size:12px;margin-top:16px;">Ce lien expire dans <strong>24 heures</strong>.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#bbb;font-size:11px;margin:0;">© 2025 CYNA — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`, firstName, verifyLink, verifyLink)

	if err := sendEmail(to, subject, html); err != nil {
		log.Printf("[EMAIL] Erreur envoi vérification à %s: %v", to, err)
	}
}
