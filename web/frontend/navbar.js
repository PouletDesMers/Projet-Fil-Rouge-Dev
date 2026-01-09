document.addEventListener("DOMContentLoaded", () => {
    const navbarContainer = document.getElementById("navbar-container");
    if (!navbarContainer) return;

    fetch("/navbar.html")
        .then(response => response.text())
        .then(html => {
            navbarContainer.innerHTML = html;
            initNavbarAuth();
            initializeCartBadge(); // Ensure badge is updated after navbar loads
            // Notification pour les autres scripts (ex: cart.js)
            document.dispatchEvent(new CustomEvent("navbarLoaded"));
        })
        .catch(err => console.error("Erreur chargement navbar:", err));
});

function initNavbarAuth() {
    const token = localStorage.getItem("token");
    const loginBtn = document.getElementById("loginBtn");
    const accountDropdown = document.getElementById("accountDropdown");
    const logoutBtn = document.getElementById("logoutBtn");

    if (token) {
        accountDropdown?.classList.remove("d-none");
        loginBtn?.classList.add("d-none");
    } else {
        accountDropdown?.classList.add("d-none");
        loginBtn?.classList.remove("d-none");
    }

    logoutBtn?.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user_id");
        window.location.href = "/index.html";
    });

    // Handle active link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

function initializeCartBadge() {
    // If cart.js is loaded, it might have its own update function
    // but we can trigger it here if it's available globally or just re-run the logic
    if (typeof updateCartBadge === 'function') {
        updateCartBadge();
    }
}
