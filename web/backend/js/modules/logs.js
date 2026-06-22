/**
 * AdminLogs Module
 * Affiche les logs de l'API avec cache local + chargement incremental
 *
 * OPTIMISATIONS :
 * - _allLogs[] : tous les logs accumulés en mémoire → export CSV complet
 * - Refresh manuel = 50 logs (léger), fusionnés sans doublon
 * - Cooldown de 5s sur le bouton refresh (anti-flood 429)
 * - Barre de statut visible : dernière mise à jour + nouveaux logs
 * - Jamais mis dans le cache global (données temps réel)
 */

const AdminLogs = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let autoRefreshTimer = null;
  let autoRefreshEnabled = false;
  const AUTO_REFRESH_INTERVAL = 60000; // 60s
  let isFetchingLogs = false;
  let isInitialized = false;
  let statsTimer = null;
  let refreshCooldownTimer = null;

  // Cache local : tous les logs chargés, accumulés en mémoire
  let _allLogs = [];
  const INITIAL_LIMIT = 5000; // Max autorisé par l'API backend (première charge)
  const REFRESH_LIMIT = 50; // Refresh manuel ou auto (juste les nouveaux)
  const REFRESH_COOLDOWN_MS = 5000; // 5 secondes entre deux refresh manuels

  // ── Helpers ────────────────────────────────────────────────────────────────
  function levelBadge(level) {
    const map = {
      DEBUG: ["bg-secondary", "bi-bug"],
      INFO: ["bg-info text-dark", "bi-info-circle"],
      WARN: ["bg-warning text-dark", "bi-exclamation-triangle"],
      ERROR: ["bg-danger", "bi-x-octagon"],
      SECURITY: ["bg-dark", "bi-shield-exclamation"],
    };
    const [cls, icon] = map[level] || ["bg-secondary", "bi-circle"];
    return `<span class="badge ${cls}"><i class="bi ${icon} me-1"></i>${level}</span>`;
  }

  function statusBadge(status) {
    if (!status) return "";
    let cls = "bg-success";
    if (status >= 500) cls = "bg-danger";
    else if (status >= 400) cls = "bg-warning text-dark";
    else if (status >= 300) cls = "bg-info text-dark";
    return `<span class="badge ${cls}">${status}</span>`;
  }

  function formatTimestamp(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Barre de statut ────────────────────────────────────────────────────────
  function _updateLastUpdate() {
    const el = document.getElementById("log-last-update");
    if (el) {
      el.innerHTML =
        `<i class="bi bi-clock me-1"></i>Mis à jour à ` +
        new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
  }

  function _showNewLogs(count) {
    const container = document.getElementById("log-new-count-container");
    const badge = document.getElementById("log-new-count-badge");
    if (!container || !badge) return;

    badge.innerHTML = `<i class="bi bi-arrow-up-circle me-1"></i>+${count} nouveau${count > 1 ? "x" : ""}`;
    container.style.display = "inline";

    // Cliquer dessus recharge la liste complète
    badge.style.cursor = "pointer";
    badge.title = "Cliquez pour recharger la liste complète";
    badge.onclick = () => _fetchAndRender(false);

    // Disparition automatique après 8s
    clearTimeout(badge._hideTimer);
    badge._hideTimer = setTimeout(() => {
      container.style.display = "none";
    }, 8000);
  }

  function _hideNewLogs() {
    const container = document.getElementById("log-new-count-container");
    if (container) container.style.display = "none";
  }

  function _setApiStatus(ok, msg) {
    const el = document.getElementById("log-api-status");
    if (!el) return;
    if (ok) {
      el.innerHTML = `<i class="bi bi-wifi me-1"></i>API OK`;
      el.className = "text-muted small";
    } else {
      el.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${msg || "API indisponible"}`;
      el.className = "text-danger small fw-bold";
    }
  }

  // ── Load stats (dissocié de loadLogs) ─────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch("/admin/api/logs/stats", {
        credentials: "include",
      });
      if (!res.ok) return;
      const s = await res.json();
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v ?? 0;
      };
      set("log-stat-total", s.total);
      set("log-stat-info", s.INFO);
      set("log-stat-warn", s.WARN);
      set("log-stat-error", s.ERROR);
      set("log-stat-security", s.SECURITY);
    } catch (e) {
      console.error("Erreur stats logs:", e);
    }
  }

  // ── Fusionner de nouveaux logs dans _allLogs (sans doublon) ──────────────
  // Retourne le nombre de nouveaux logs ajoutés.
  function _mergeLogs(newLogs) {
    if (!Array.isArray(newLogs) || newLogs.length === 0) return 0;
    const existingIds = new Set(_allLogs.map((l) => l.id));
    let added = 0;
    for (const log of newLogs) {
      if (!existingIds.has(log.id)) {
        _allLogs.unshift(log);
        existingIds.add(log.id);
        added++;
      }
    }
    if (added > 0) {
      console.debug(
        `[Logs] ${added} nouveau(x) log(s) ajouté(s) au cache local (total: ${_allLogs.length})`,
      );
    }
    return added;
  }

  // ── Rendre le tableau à partir de _allLogs (avec filtre status client) ───
  function _renderTable(logs) {
    const tbody = document.getElementById("logsTableBody");
    const container = document.getElementById("logsTableContainer");
    const emptyState = document.getElementById("logsEmptyState");
    if (!tbody || !container || !emptyState) return;

    if (logs.length === 0) {
      container.classList.add("d-none");
      emptyState.classList.remove("d-none");
      const countEl = document.getElementById("log-count");
      if (countEl) countEl.textContent = "0 entrée(s)";
      return;
    }

    container.classList.remove("d-none");
    emptyState.classList.add("d-none");
    const countEl = document.getElementById("log-count");
    if (countEl) countEl.textContent = `${logs.length} entrée(s)`;

    const methodColors = {
      GET: "bg-success",
      POST: "bg-primary",
      PUT: "bg-warning text-dark",
      PATCH: "bg-warning text-dark",
      DELETE: "bg-danger",
      OPTIONS: "bg-secondary",
    };

    tbody.innerHTML = logs
      .map((e) => {
        const rowClass =
          e.level === "ERROR"
            ? "table-danger"
            : e.level === "SECURITY"
              ? "table-dark text-white"
              : e.level === "WARN"
                ? "table-warning"
                : "";

        const methodBadge = e.method
          ? `<span class="badge ${methodColors[e.method] || "bg-secondary"} me-1">${escapeHtml(e.method)}</span>`
          : "";

        const pathText = e.path
          ? `<code class="small text-break">${escapeHtml(e.path)}</code>`
          : '<span class="text-muted">—</span>';

        const userText =
          e.user_id != null && e.user_id !== 0
            ? `<span class="badge bg-light text-dark border">👤 ${e.user_id}</span>`
            : '<span class="text-muted small">—</span>';

        return `<tr class="${rowClass}">
          <td class="text-nowrap small text-muted">${formatTimestamp(e.timestamp)}</td>
          <td>${levelBadge(e.level)}</td>
          <td class="text-nowrap">${methodBadge}${pathText}</td>
          <td>${statusBadge(e.status)}</td>
          <td><span class="small">${escapeHtml(e.message) || "—"}</span></td>
          <td class="small text-muted text-nowrap">${escapeHtml(e.ip) || "—"}</td>
          <td class="small text-muted text-nowrap">${e.duration || "—"}</td>
          <td>${userText}</td>
        </tr>`;
      })
      .join("");
  }

  // ── Appliquer le filtre status HTTP côté client sur _allLogs ─────────────
  function _getFilteredLogs() {
    const statusF = document.getElementById("logStatusFilter")?.value || "";
    if (!statusF) return _allLogs;
    const min = parseInt(statusF);
    return _allLogs.filter((e) => e.status >= min && e.status < min + 100);
  }

  // ── Fetch principal + rendu ──────────────────────────────────────────────
  // isRefresh = true  → fetch 50 logs, fusion, badge "+N nouveaux"
  // isRefresh = false → fetch 5000 logs, remplace tout le cache
  async function _fetchAndRender(isRefresh = false) {
    if (isFetchingLogs) return;

    const tbody = document.getElementById("logsTableBody");
    const container = document.getElementById("logsTableContainer");
    const emptyState = document.getElementById("logsEmptyState");
    if (!tbody || !container || !emptyState) return;

    isFetchingLogs = true;

    const limit = isRefresh ? REFRESH_LIMIT : INITIAL_LIMIT;
    const level = document.getElementById("logLevelFilter")?.value || "ALL";
    const method = document.getElementById("logMethodFilter")?.value || "";
    const search =
      document.getElementById("logSearchInput")?.value?.trim() || "";
    const dateFrom = document.getElementById("logDateFrom")?.value || "";
    const dateTo = document.getElementById("logDateTo")?.value || "";

    const params = new URLSearchParams({ limit: String(limit) });
    if (level && level !== "ALL") params.set("level", level);
    if (search) params.set("search", search);
    if (method) params.set("method", method);
    if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("date_to", new Date(dateTo).toISOString());

    try {
      const res = await fetch(`/admin/api/logs?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let logs = await res.json();
      if (!Array.isArray(logs)) logs = [];

      _setApiStatus(true);

      if (isRefresh) {
        // Refresh léger : fusionner les nouveaux logs dans le cache local
        const added = _mergeLogs(logs);
        if (added > 0) {
          _showNewLogs(added);
          // Toast pour les utilisateurs qui ne regardent pas le badge
          AdminUtils?.showToast?.(
            `${added} nouveau${added > 1 ? "x" : ""} log${added > 1 ? "s" : ""} détecté${added > 1 ? "s" : ""}`,
            "success",
          );
        }
      } else {
        // Chargement complet : remplacer tout le cache
        _allLogs = logs;
        _hideNewLogs();
      }

      // Mettre à jour l'horodatage
      _updateLastUpdate();

      // Appliquer le filtre status HTTP côté client et rendre
      const displayLogs = _getFilteredLogs();
      _renderTable(displayLogs);
    } catch (e) {
      console.error("Erreur chargement logs:", e);
      _setApiStatus(false, "Erreur " + e.message);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erreur de chargement des logs</td></tr>`;
    } finally {
      isFetchingLogs = false;
    }
  }

  // ── Points d'entrée publics ──────────────────────────────────────────────
  async function loadLogs() {
    await _fetchAndRender(false);
  }

  // ── Reset filtres ────────────────────────────────────────────────────────
  function resetFilters() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set("logLevelFilter", "ALL");
    set("logMethodFilter", "");
    set("logStatusFilter", "");
    set("logLimitSelect", "5000");
    set("logSearchInput", "");
    set("logDateFrom", "");
    set("logDateTo", "");
    _fetchAndRender(false);
  }

  // ── Auto-refresh ─────────────────────────────────────────────────────────
  function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const btn = document.getElementById("autoRefreshBtn");
    if (autoRefreshEnabled) {
      autoRefreshTimer = setInterval(
        () => _fetchAndRender(true),
        AUTO_REFRESH_INTERVAL,
      );
      btn.classList.replace("btn-outline-secondary", "btn-success");
      btn.innerHTML = '<i class="bi bi-pause-circle me-1"></i>Auto (60s)';
    } else {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      btn.classList.replace("btn-success", "btn-outline-secondary");
      btn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Auto refresh';
    }
  }

  // ── Cooldown du bouton refresh (anti-flood 5s) ──────────────────────────
  function _applyRefreshCooldown() {
    const btn = document.getElementById("refreshLogsBtn");
    if (!btn) return;
    btn.disabled = true;
    const origHTML = btn.innerHTML;
    let remaining = Math.ceil(REFRESH_COOLDOWN_MS / 1000);
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${remaining}s`;

    if (refreshCooldownTimer) clearInterval(refreshCooldownTimer);
    refreshCooldownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(refreshCooldownTimer);
        refreshCooldownTimer = null;
        btn.disabled = false;
        btn.innerHTML = origHTML;
      } else {
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${remaining}s`;
      }
    }, 1000);
  }

  // ── Clear logs ───────────────────────────────────────────────────────────
  async function clearLogs() {
    if (
      !confirm(
        "Vider tous les logs en mémoire ? Cette action est irréversible.",
      )
    )
      return;
    try {
      const res = await fetch("/admin/api/logs", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _allLogs = [];
      _hideNewLogs();
      await _fetchAndRender(false);
      AdminUtils.showToast("Logs vidés avec succès", "success");
    } catch {
      AdminUtils.showToast("Erreur lors de la suppression des logs", "danger");
    }
  }

  // ── Export CSV (depuis _allLogs, PAS depuis l'affichage) ─────────────────
  function exportCSV() {
    if (_allLogs.length === 0) {
      AdminUtils.showToast("Aucun log à exporter", "warning");
      return;
    }
    const headers = [
      "ID",
      "Timestamp",
      "Level",
      "Method",
      "Path",
      "Status",
      "Message",
      "IP",
      "Duration",
      "UserID",
    ];
    const lines = [headers.join(",")];
    _allLogs.forEach((log) => {
      const values = [
        log.id ?? "",
        log.timestamp ?? "",
        log.level ?? "",
        log.method ?? "",
        log.path ?? "",
        log.status ?? "",
        (log.message || "").replace(/"/g, '""'),
        log.ip ?? "",
        log.duration ?? "",
        log.user_id ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    AdminUtils.showToast(`${_allLogs.length} logs exportés en CSV`, "success");
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    if (!isInitialized) {
      let filterTimeout;
      function debouncedLoad() {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => _fetchAndRender(false), 400);
      }

      // Filtres (rechargement complet 5000 logs)
      [
        "logLevelFilter",
        "logMethodFilter",
        "logLimitSelect",
        "logDateFrom",
        "logDateTo",
      ].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", debouncedLoad);
      });

      // Recherche texte (debounced)
      document
        .getElementById("logSearchInput")
        ?.addEventListener("input", debouncedLoad);

      // Le filtre status s'applique côté client → pas de rechargement API
      document
        .getElementById("logStatusFilter")
        ?.addEventListener("change", () => {
          const displayLogs = _getFilteredLogs();
          _renderTable(displayLogs);
        });

      // Bouton Refresh : cooldown 5s + refresh léger (50 logs)
      document
        .getElementById("refreshLogsBtn")
        ?.addEventListener("click", () => {
          if (document.getElementById("refreshLogsBtn")?.disabled) return;
          _applyRefreshCooldown();
          _fetchAndRender(true);
        });

      document
        .getElementById("autoRefreshBtn")
        ?.addEventListener("click", toggleAutoRefresh);
      document
        .getElementById("clearLogsBtn")
        ?.addEventListener("click", clearLogs);
      document
        .getElementById("exportLogsBtn")
        ?.addEventListener("click", exportCSV);
      document
        .getElementById("logResetFilters")
        ?.addEventListener("click", resetFilters);

      isInitialized = true;
    }

    // Premier chargement différé 500ms + stats 1s après
    setTimeout(() => {
      _fetchAndRender(false);
      clearTimeout(statsTimer);
      statsTimer = setTimeout(loadStats, 1000);
    }, 500);
  }

  function destroy() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      autoRefreshEnabled = false;
    }
    clearTimeout(statsTimer);
    statsTimer = null;
  }

  return { init, loadLogs, destroy };
})();
