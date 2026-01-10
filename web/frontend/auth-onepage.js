const API_BASE = "";

const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

// Elements
const msg = document.getElementById("msg");
const msgTitle = document.getElementById("msgTitle");
const msgText = document.getElementById("msgText");

// Password toggles logic
function initPasswordToggles() {
  document.querySelectorAll(".password-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const inputId = button.getAttribute("data-target");
      const input = document.getElementById(inputId);
      const icon = button.querySelector("i");
      
      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("bi-eye", "bi-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("bi-eye-slash", "bi-eye");
      }
    });
  });
}
initPasswordToggles();

const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("email");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const twoFAForm = document.getElementById("twoFAForm");
const totpCodeInput = document.getElementById("totpCodeInput");
const backToLogin = document.getElementById("backToLogin");

const registerForm = document.getElementById("registerForm");
const registerEmailInput = document.getElementById("registerEmailInput");
const regPassword = document.getElementById("regPassword");
const regPassword2 = document.getElementById("regPassword2");

const back1 = document.getElementById("back1");
const back2 = document.getElementById("back2");

const newToCyna = document.getElementById("newToCyna");
const createAccountBtn = document.getElementById("createAccountBtn");
const authTitle = document.getElementById("authTitle");

const helpTrigger = document.getElementById("helpTrigger");
const helpLinks = document.getElementById("helpLinks");

if (helpTrigger) {
  helpTrigger.querySelector("a").addEventListener("click", (e) => {
    e.preventDefault();
    const icon = helpTrigger.querySelector("i");
    helpLinks.classList.toggle("d-none");
    if (helpLinks.classList.contains("d-none")) {
       icon.className = "bi bi-caret-right-fill small text-muted";
    } else {
       icon.className = "bi bi-caret-down-fill small text-muted";
    }
  });
}

// Gestion du bouton 2FA
const twoFABtn = document.getElementById("twoFABtn");

let currentEmail = "";

function showMsg(type, text, title = "There was a problem") {
  msgTitle.textContent = title;
  msgText.textContent = text;
  msg.classList.remove("d-none");
  // type is not used with the new amazon style box but kept for compatibility
}
function hideMsg() {
  msg.classList.add("d-none");
}

function showStep(step) {
  // step: "email" | "login" | "twofa" | "register"
  emailForm.classList.toggle("d-none", step !== "email");
  loginForm.classList.toggle("d-none", step !== "login");
  twoFAForm.classList.toggle("d-none", step !== "twofa");
  registerForm.classList.toggle("d-none", step !== "register");
  
  // Amazon specific: Title changes or disappears
  if (step === "email" || step === "login") {
    authTitle.textContent = "Sign in";
    authTitle.classList.remove("d-none");
    newToCyna.classList.toggle("d-none", step === "login");
  } else if (step === "twofa") {
    authTitle.classList.add("d-none");
    newToCyna.classList.add("d-none");
  } else {
    // Register has its own title inside the form
    authTitle.classList.add("d-none");
    newToCyna.classList.add("d-none");
  }
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
  try {
    payload = await res.json();
  } catch {}
  if (!res.ok)
    throw new Error(
      payload?.message || payload?.error || `Erreur HTTP ${res.status}`
    );
  return payload;
}

async function emailExists(email) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `/api/users/exists?email=${encodeURIComponent(email)}`;
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
    const exists = await emailExists(currentEmail);

    if (exists) {
      loginEmail.textContent = currentEmail;
      loginPassword.value = "";
      showStep("login");
    } else {
      showMsg("danger", "We cannot find an account with that e-mail address");
    }
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// Create account button (Amazon style step)
createAccountBtn.addEventListener("click", (e) => {
  e.preventDefault();
  hideMsg();
  currentEmail = emailInput.value.trim().toLowerCase();
  registerEmailInput.value = currentEmail;
  showStep("register");
});

// Back buttons
back1.addEventListener("click", () => {
  hideMsg();
  showStep("email");
});
back2.addEventListener("click", () => {
  hideMsg();
  showStep("email");
});

// Login submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  try {
    const result = await postJSON(`${API_BASE}/api/login`, {
      email: currentEmail,
      password: loginPassword.value,
    });

    // Check if 2FA is required
    if (result?.requires_2fa) {
      showStep("twofa");
      totpCodeInput.focus();
      return;
    }

    if (result?.token) {
      localStorage.setItem("token", result.token);
      if (result.user_id) localStorage.setItem("user_id", result.user_id);
    }

    showMsg("success", "Connected ✅", "Success");
    setTimeout(() => (window.location.href = "/index.html"), 500);
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// 2FA Submit
twoFAForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  
  const code = totpCodeInput.value.trim();
  if (code.length !== 6) {
    showMsg("danger", "Please enter a valid 6-digit code.");
    return;
  }

  try {
    const result = await postJSON(`${API_BASE}/api/login`, {
      email: currentEmail,
      password: loginPassword.value,
      totpCode: code,
    });

    if (result?.token) {
      localStorage.setItem("token", result.token);
      if (result.user_id) localStorage.setItem("user_id", result.user_id);
      
      showMsg("success", "Connected ✅", "Success");
      setTimeout(() => (window.location.href = "/index.html"), 500);
    }
  } catch (err) {
    showMsg("danger", err.message);
    totpCodeInput.value = "";
  }
});

backToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  showStep("login");
});

// Register submit
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  const formData = Object.fromEntries(new FormData(registerForm).entries());
  const pwd = regPassword.value;
  const pwd2 = regPassword2.value;

  if (!isPasswordValid(pwd)) {
    showMsg("danger", "Password too weak (8+, upper/lower/digit/special).");
    return;
  }
  if (pwd !== pwd2) {
    showMsg("danger", "Passwords do not match.");
    return;
  }

  try {
    const emailToUse = currentEmail || emailInput.value.trim().toLowerCase();
    
    await postJSON(`${API_BASE}/api/users`, {
      email: emailToUse,
      password: pwd,
      lastName: formData.lastName,
      firstName: formData.firstName,
    });

    showStep("login");
    loginEmail.textContent = emailToUse;
    showMsg("success", "Account created ✅ You can now log in.", "Success");
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// init
showStep("email");
