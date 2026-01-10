const API_BASE = "";

const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

// Elements
const msg = document.getElementById("msg");

// Password toggles
document.querySelectorAll(".password-toggle").forEach((button) => {
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
    showMsg("secondary", "Checking...");

    const exists = await emailExists(currentEmail);

    hideMsg();
    if (exists) {
      loginEmail.textContent = currentEmail;
      loginPassword.value = "";
      showStep("login");
    } else {
      registerEmail.textContent = currentEmail;
      registerForm.reset();
      // keep email in memory
      showStep("register");
    }
  } catch (err) {
    showMsg("danger", err.message);
  }
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
    showMsg("secondary", "Connecting...");

    const result = await postJSON(`${API_BASE}/api/login`, {
      email: currentEmail,
      password: loginPassword.value,
    });

    // Check if 2FA is required
    if (result?.requires_2fa) {
      hideMsg();
      // Show 2FA input
      const totpCode = prompt("Enter your 2FA code (6 digits):");
      if (!totpCode) {
        showMsg("warning", "2FA code required to log in.");
        return;
      }

      // Retry login with 2FA code
      showMsg("secondary", "Verifying 2FA code...");
      const result2fa = await postJSON(`${API_BASE}/api/login`, {
        email: currentEmail,
        password: loginPassword.value,
        totpCode: totpCode,
      });

      if (result2fa?.token) {
        localStorage.setItem("token", result2fa.token);
        if (result2fa.user_id)
          localStorage.setItem("user_id", result2fa.user_id);
      }

      showMsg("success", "Connected ✅");
      setTimeout(() => (window.location.href = "/index.html"), 500);
      return;
    }

    if (result?.token) {
      localStorage.setItem("token", result.token);
      if (result.user_id) localStorage.setItem("user_id", result.user_id);
    }

    showMsg("success", "Connected ✅");
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
    showMsg("danger", "Password too weak (8+, upper/lower/digit/special).");
    return;
  }
  if (pwd !== pwd2) {
    showMsg("danger", "Passwords do not match.");
    return;
  }

  try {
    showMsg("secondary", "Creating account...");

    await postJSON(`${API_BASE}/api/users`, {
      email: currentEmail,
      password: pwd,
      lastName: formData.lastName,
      firstName: formData.firstName,
      phone: formData.phone || "",
      // role: "user",
      // status: "active",
    });

    showMsg("success", "Account created ✅ You can now log in.");
    setTimeout(() => {
      showStep("login");
      loginEmail.textContent = currentEmail;
    }, 600);
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// init
showStep("email");
