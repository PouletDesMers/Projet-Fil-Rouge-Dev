const DEBUG = true;

// Elements
const msg = document.getElementById("msg");
const msgTitle = document.getElementById("msgTitle");
const msgText = document.getElementById("msgText");

const requestResetForm = document.getElementById("requestResetForm");
const resetEmail = document.getElementById("resetEmail");
const confirmationStep = document.getElementById("confirmationStep");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");

function showMsg(type, text, title = "There was a problem") {
  msgTitle.textContent = title;
  msgText.textContent = text;
  msg.classList.remove("d-none");
}

function hideMsg() {
  msg.classList.add("d-none");
}

function showStep(step) {
  // step: "request" | "confirmation" | "reset"
  requestResetForm.classList.toggle("d-none", step !== "request");
  confirmationStep.classList.toggle("d-none", step !== "confirmation");
  resetPasswordForm.classList.toggle("d-none", step !== "reset");
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

// Password toggle
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

// STEP 1: Request password reset
requestResetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  const email = resetEmail.value.trim().toLowerCase();
  if (!email) return;

  try {
    await postJSON("/api/auth/request-password-reset", { email });
    showStep("confirmation");
    showMsg("success", "Email envoyé avec succès!", "Vérifiez votre boîte mail");
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// STEP 3: Reset password with token
resetPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();

  const pwd = newPassword.value;
  const pwd2 = confirmPassword.value;
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!isPasswordValid(pwd)) {
    showMsg("danger", "Mot de passe trop faible (8+, major/minor/chiffre/spécial)");
    return;
  }

  if (pwd !== pwd2) {
    showMsg("danger", "Les mots de passe ne correspondent pas");
    return;
  }

  try {
    await postJSON("/api/auth/reset-password", {
      token,
      password: pwd,
    });
    showMsg("success", "Mot de passe réinitialisé ✅", "Succès");
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 2000);
  } catch (err) {
    showMsg("danger", err.message);
  }
});

// Check if token is in URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

if (token) {
  showStep("reset");
} else {
  showStep("request");
}
