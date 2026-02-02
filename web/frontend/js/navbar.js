document.addEventListener("DOMContentLoaded", () => {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  fetch("/navbar.html")
    .then((response) => response.text())
    .then((html) => {
      navbarContainer.innerHTML = html;
      initNavbarAuth();
      initializeCartBadge(); // Ensure badge is updated after navbar loads
      // Notification pour les autres scripts (ex: cart.js)
      document.dispatchEvent(new CustomEvent("navbarLoaded"));
    })
    .catch((err) => console.error("Error loading navbar:", err));
});

// Helper functions for cookies
function setCookie(name, value, days = 30) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Strict";
}

function deleteCookie(name) {
  setCookie(name, "", -1);
}

function initNavbarAuth() {
  const token = localStorage.getItem("token");
  const loginBtn = document.getElementById("loginBtn");
  const accountDropdown = document.getElementById("accountDropdown");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminMenuItem = document.getElementById("adminMenuItem");
  const adminMenuItemContainer = document.getElementById("adminMenuItemContainer");

  if (token) {
    accountDropdown?.classList.remove("d-none");
    loginBtn?.classList.add("d-none");

    // Check if user is admin
    checkUserAdminStatus(token);
  } else {
    accountDropdown?.classList.add("d-none");
    loginBtn?.classList.remove("d-none");
    adminMenuItem?.classList.add("d-none");
    adminMenuItemContainer?.classList.add("d-none");
  }

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    // Also remove cookies
    deleteCookie("token");
    deleteCookie("user_id");
    window.location.href = "/index.html";
  });

  // Handle active link
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

async function checkUserAdminStatus(token) {
  try {
    const response = await fetch("/api/user/profile", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return;
    }

    const user = await response.json();

    const adminMenuItem = document.getElementById("adminMenuItem");
    const adminMenuItemContainer = document.getElementById("adminMenuItemContainer");

    if (user.role === "admin") {
      adminMenuItem?.classList.remove("d-none");
      adminMenuItemContainer?.classList.remove("d-none");
    } else {
      adminMenuItem?.classList.add("d-none");
      adminMenuItemContainer?.classList.add("d-none");
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
  }
}

function initializeCartBadge() {
  // If cart.js is loaded, it might have its own update function
  // but we can trigger it here if it's available globally or just re-run the logic
  if (typeof updateCartBadge === "function") {
    updateCartBadge();
  }
}
