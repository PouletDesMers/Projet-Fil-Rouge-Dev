package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// sendResendEmail envoie un email via l'API REST Resend.
// Si RESEND_API_KEY est absente, log un avertissement et retourne nil (pas de crash).
func sendResendEmail(to, subject, html string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		log.Printf("[EMAIL-DEV] RESEND_API_KEY absente — email non envoyé à %s | sujet: %s", to, subject)
		return nil
	}

	payload := resendPayload{
		From:    "CYNA <onboarding@resend.dev>",
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend API: status %d", resp.StatusCode)
	}
	return nil
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
  </div>
</body>
</html>`, code)

	if err := sendResendEmail(to, subject, html); err != nil {
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
      <p style="color:#aaa;font-size:12px;margin-top:16px;">Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte CYNA, ignorez cet email.</p>
    </div>
  </div>
</body>
</html>`, firstName, verifyLink, verifyLink)

	if err := sendResendEmail(to, subject, html); err != nil {
		log.Printf("[EMAIL] Erreur envoi vérification à %s: %v", to, err)
	}
}
