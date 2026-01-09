const API_BASE = "";

// Elements
const msg = document.getElementById("msg");

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
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  });
  let payload = null;
  try { payload = await res.json(); } catch {}
  if (!res.ok) throw new Error(payload?.message || payload?.error || `Erreur HTTP ${res.status}`);
  return payload;
}

async function emailExists(email) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `/api/utilisateurs/exists?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers });
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
