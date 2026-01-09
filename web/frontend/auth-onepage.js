const API_BASE = "";

const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

// Elements
const msg = document.getElementById("msg");

// Password toggles
document.querySelectorAll(".password-toggle").forEach(button => {
  button.innerHTML = EYE_ICON; // Initial icon
  button.addEventListener("click", () => {
    const inputId = button.getAttribute("data-target");
    const input = document.getElementById(inputId);
    if (input.type === "password") {
      input.type = "text";
      button.innerHTML = EYE_OFF_ICON;
    } else {
      input.type = "password";
      button.innerHTML = EYE_ICON;
    }
  });
});

const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("email");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerForm = document.getElementById("registerForm");
const registerEmail = document.getElementById("registerEmail");
const regPassword = document.getElementById("regPassword");
const regPassword2 = document.getElementById("regPassword2");

const back1 = document.getElementById("back1");
const back2 = document.getElementById("back2");

// Gestion du bouton 2FA
const twoFABtn = document.getElementById("twoFABtn");

let currentEmail = "";

function showMsg(type, text) {
  msg.className = `alert alert-${type}`;
  msg.textContent = text;
  msg.classList.remove("d-none");
}
function hideMsg() {
  msg.classList.add("d-none");
}

function showStep(step) {
  // step: "email" | "login" | "register"
  emailForm.classList.toggle("d-none", step !== "email");
  loginForm.classList.toggle("d-none", step !== "login");
  registerForm.classList.toggle("d-none", step !== "register");
}

function isPasswordValid(pwd) {
  return (
    pwd.length >= 8 &&
    /[a-z]/.test(pwd) &&
    /[A-Z]/.test(pwd) &&
    /\d/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  let payload = null;
  try { payload = await res.json(); } catch {}
  if (!res.ok) throw new Error(payload?.message || payload?.error || `Erreur HTTP ${res.status}`);
  return payload;
}

/**
 * ✅ IMPORTANT :
 * Il te faut idéalement un endpoint Go du style:
 *   GET /utilisateurs/exists?email=...
 * qui renvoie { "exists": true } ou { "exists": false }
 *
 * Si tu ne l'as pas, je te donne juste après une alternative (moins propre).
 */
async function emailExists(email) {
  const url = `http://localhost:8080/api/utilisateurs/exists?email=${encodeURIComponent(email)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur check email (${res.status})`);
  const data = await res.json();
  return !!data.exists;
}

// Step 1: submit email
emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  currentEmail = emailInput.value.trim().toLowerCase();
  if (!currentEmail) return;

  try {
    showMsg("secondary", "Vérification en cours...");

    const exists = await emailExists(currentEmail);

    hideMsg();
    if (exists) {
      loginEmail.textContent = currentEmail;
      loginPassword.value = "";
      showStep("login");
    } else {
      registerEmail.textContent = currentEmail;
      registerForm.reset();
      // on garde l'email en mémoire (pas dans un input visible)
      showStep("register");
    }
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// Back buttons
back1.addEventListener("click", () => { hideMsg(); showStep("email"); });
back2.addEventListener("click", () => { hideMsg(); showStep("email"); });

// Login submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  try {
    showMsg("secondary", "Connexion...");

    // ✅ à adapter si ton endpoint login n'est pas /login
    const result = await postJSON(`${API_BASE}/api/login`, {
      email: currentEmail,
      mot_de_passe: loginPassword.value,
    });

    // Check if 2FA is required
    if (result?.requires_2fa) {
      hideMsg();
      // Show 2FA input
      const totpCode = prompt("Entrez votre code 2FA (6 chiffres):");
      if (!totpCode) {
        showMsg("warning", "Code 2FA requis pour se connecter.");
        return;
      }

      // Retry login with 2FA code
      showMsg("secondary", "Vérification du code 2FA...");
      const result2fa = await postJSON(`${API_BASE}/api/login`, {
        email: currentEmail,
        mot_de_passe: loginPassword.value,
        totp_code: totpCode,
      });

      if (result2fa?.token) {
        localStorage.setItem("token", result2fa.token);
        if (result2fa.user_id) localStorage.setItem("user_id", result2fa.user_id);
      }
      
      showMsg("success", "Connecté ✅");
      setTimeout(() => (window.location.href = "/index.html"), 500);
      return;
    }

    if (result?.token) {
      localStorage.setItem("token", result.token);
      if (result.user_id) localStorage.setItem("user_id", result.user_id);
    }

    showMsg("success", "Connecté ✅");
    setTimeout(() => (window.location.href = "/index.html"), 500);
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// Register submit
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  const formData = Object.fromEntries(new FormData(registerForm).entries());
  const pwd = regPassword.value;
  const pwd2 = regPassword2.value;

  if (!isPasswordValid(pwd)) {
    showMsg("danger", "Mot de passe trop faible (8+, maj/min/chiffre/spécial).");
    return;
  }
  if (pwd !== pwd2) {
    showMsg("danger", "Les mots de passe ne correspondent pas.");
    return;
  }

  try {
    showMsg("secondary", "Création du compte...");

    // ✅ à adapter si ton endpoint register n'est pas POST /utilisateurs
    await postJSON(`${API_BASE}/api/utilisateurs`, {
      email: currentEmail,
      mot_de_passe: pwd,
      nom: formData.nom,
      prenom: formData.prenom,
      telephone: formData.telephone || "",
      // role: "user",
      // statut: "actif",
    });

    showMsg("success", "Compte créé ✅ Tu peux te connecter.");
    setTimeout(() => { showStep("login"); loginEmail.textContent = currentEmail; }, 600);
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// init
showStep("email");
