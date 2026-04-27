// ============================================================
// Module : Sauvegardes BDD
// ============================================================
// Sauvegarde via pg_dump → fichier .sql dans /backups/pgdump/
// Planification automatique via Go ticker (côté API)
// Types : "data" (sans logs) | "logs" (api_logs seulement) | "full" (tout)

const AdminBackup = (() => {
  let backupInProgress = false;

  // ===== INIT =====
  async function load() {
    // allSettled pour qu'une requête lente ne bloque pas les autres
    await Promise.allSettled([
      refreshBackupList(),
      refreshSchedule(),
      refreshStats(),
    ]);
  }

  // ===== BACKUP MANUEL ASYNCHRONE =====
  async function triggerManualBackup(backupType) {
    if (backupInProgress) return;

    if (!backupType) {
      const sel = document.getElementById("backup-type-select");
      backupType = sel ? sel.value : "full";
    }

    const btn = document.getElementById("btn-manual-backup");
    backupInProgress = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Sauvegarde en cours…';
    }
    const typeLabel =
      { data: "données", logs: "logs", full: "complet" }[backupType] ||
      backupType;
    setStatus("info", `⏳ Sauvegarde (${typeLabel}) en cours…`);

    try {
      const resp = await fetch("/admin/api/backup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: backupType }),
      });

      if (resp.status === 409) {
        const data = await resp.json();
        setStatus(
          "warning",
          `⚠️ ${data.error || "Un backup est déjà en cours"}`,
        );
        backupInProgress = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML =
            '<i class="bi bi-shield-check me-2"></i>Lancer la sauvegarde';
        }
        return;
      }

      if (!resp.ok) {
        const data = await resp.json();
        setStatus("danger", `❌ Échec : ${data.error || resp.statusText}`);
        backupInProgress = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML =
            '<i class="bi bi-shield-check me-2"></i>Lancer la sauvegarde';
        }
        return;
      }

      // Backup démarré en arrière-plan → on va poller le statut
      setStatus(
        "info",
        `⏳ Sauvegarde (${typeLabel}) en cours… Veuillez patienter`,
      );

      // Polling toutes les 2s
      await _pollBackupStatus(btn, typeLabel);

      await Promise.all([refreshBackupList(), refreshStats()]);
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    } finally {
      backupInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="bi bi-shield-check me-2"></i>Lancer la sauvegarde';
      }
    }
  }

  // ===== POLLING STATUT BACKUP =====
  async function _pollBackupStatus(btn, typeLabel) {
    let pollCount = 0;
    const maxPolls = 120; // 120 × 2s = 4 min max

    while (pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 2000));
      pollCount++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch("/admin/api/backup/status", {
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!resp.ok) continue;

        const status = await resp.json();

        if (status.running) {
          // Backup encore en cours
          const elapsed = Math.floor(
            (Date.now() - new Date(status.started_at).getTime()) / 1000,
          );
          setStatus(
            "info",
            `⏳ Sauvegarde (${typeLabel}) en cours… (${elapsed}s)`,
          );
          continue;
        }

        // Backup terminé
        if (status.success) {
          setStatus(
            "success",
            `✅ Sauvegarde <strong>${typeLabel}</strong> créée ! <strong>${status.file_name || ""}</strong>`,
          );
        } else {
          setStatus(
            "danger",
            `❌ Sauvegarde échouée : ${status.error || "Erreur inconnue"}`,
          );
        }
        return;
      } catch (e) {
        // Erreur de polling, on réessaie
        console.warn("Poll backup status error:", e);
      }
    }

    // Timeout atteint
    setStatus(
      "warning",
      `⚠️ Le backup (${typeLabel}) prend plus de temps que prévu. Vérifiez le statut dans la liste.`,
    );
  }

  // ===== LISTE DES BACKUPS =====
  async function refreshBackupList() {
    const tbody = document.getElementById("backup-files-tbody");
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</td></tr>';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/list", {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        if (resp.status === 500) {
          tbody.innerHTML =
            '<tr><td colspan="6" class="text-center text-warning py-3"><i class="bi bi-exclamation-triangle me-2"></i>Backup non configuré — configurez RESTIC_PASSWORD ou utilisez le fallback pg_dump</td></tr>';
        } else {
          tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur ${resp.status}</td></tr>`;
        }
        return;
      }
      const data = await resp.json();
      const snapshots = data.snapshots || [];

      if (snapshots.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="text-center text-muted fst-italic py-3">Aucune sauvegarde — créez votre premier backup</td></tr>';
        return;
      }

      tbody.innerHTML = snapshots
        .map((s) => {
          const shortId = (s.short_id || s.id || "").slice(0, 30);
          const date = new Date(s.time).toLocaleString("fr-FR");
          const tags = s.tags || [];

          // Type de backup (depuis les tags ou le nom du fichier)
          const typeTag =
            tags.find((t) => ["data", "logs", "full"].includes(t)) || "full";
          const typeColor =
            { data: "info", logs: "warning", full: "success" }[typeTag] ||
            "secondary";
          const typeLabel =
            { data: "💾 Données", logs: "📋 Logs", full: "🗄️ Complète" }[
              typeTag
            ] || typeTag;
          const typeBadge = `<span class="badge bg-${typeColor} me-1">${typeLabel}</span>`;

          // Mode (auto/manuel)
          const modeBadge = tags.includes("auto")
            ? '<span class="badge bg-primary me-1">Auto</span>'
            : '<span class="badge bg-secondary me-1">Manuel</span>';

          return `
          <tr>
            <td><code class="text-primary small">${esc(shortId)}</code></td>
            <td>${date}</td>
            <td>${typeBadge}${modeBadge}</td>
            <td>${esc(s.hostname || "—")}</td>
            <td class="text-end text-nowrap">
              <button class="btn btn-sm btn-outline-primary me-1" onclick="AdminBackup.downloadSnapshot('${esc(s.id || s.short_id)}')" title="Télécharger le fichier SQL">
                <i class="bi bi-download"></i>
              </button>
              <button class="btn btn-sm btn-outline-warning me-1" onclick="AdminBackup.confirmRestore('${esc(s.id || s.short_id)}')" title="Restaurer">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
            </td>
          </tr>
        `;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur : ${e.message}</td></tr>`;
    }
  }

  // ===== STATS =====
  async function refreshStats() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/stats", {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) return;
      const stats = await resp.json();

      const elSize = document.getElementById("backup-repo-size");
      const elCount = document.getElementById("backup-snap-count");
      const elFiles = document.getElementById("backup-file-count");

      if (elSize) elSize.textContent = humanSize(stats.total_size || 0);
      if (elCount) elCount.textContent = stats.snapshots_count ?? "—";
      if (elFiles) elFiles.textContent = stats.total_file_count ?? "—";
    } catch (e) {
      console.error("refreshStats:", e);
    }
  }

  // ===== TÉLÉCHARGER =====
  async function downloadSnapshot(snapshotId) {
    setStatus("info", `⏳ Téléchargement de ${snapshotId.slice(0, 30)}…`);
    const url = `/admin/api/backup/download?snapshot=${encodeURIComponent(snapshotId)}`;
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        setStatus(
          "danger",
          `❌ Téléchargement impossible : ${resp.statusText}`,
        );
        return;
      }
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-${snapshotId.slice(0, 20)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatus("success", `✅ Fichier ${snapshotId.slice(0, 30)} téléchargé.`);
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    }
  }

  // ===== RESTAURER =====
  async function confirmRestore(snapshotId) {
    const shortId = snapshotId.slice(0, 30);
    if (
      !confirm(
        `⚠️ RESTAURER la sauvegarde ${shortId} ?\n\nCeci va ÉCRASER les données actuelles !\n⚠️ Toutes les modifications depuis cette sauvegarde seront perdues.\n\nConfirmer ?`,
      )
    )
      return;

    setStatus("warning", `⏳ Restauration de ${shortId} en cours…`);
    try {
      const resp = await fetch("/admin/api/backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_id: snapshotId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus("danger", `❌ Restauration échouée : ${data.error}`);
        return;
      }
      const typeLabel = data.backup_type ? ` (type: ${data.backup_type})` : "";
      setStatus(
        "success",
        `✅ Base de données restaurée depuis <strong>${shortId}</strong>${typeLabel} avec succès !`,
      );
      await refreshBackupList();
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    }
  }

  // ===== PLANIFICATIONS =====
  async function refreshSchedule() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/schedule", {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) return;
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
    } catch (e) {
      console.error("refreshSchedule:", e);
    }
  }

  function renderScheduleRules(rules) {
    const tbody = document.getElementById("schedule-rules-body");
    if (!tbody) return;

    if (!rules.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">
        <i class="bi bi-calendar-x me-2"></i>Aucune planification configurée
      </td></tr>`;
      return;
    }

    const typeLabels = {
      data: "💾 Données",
      logs: "📋 Logs",
      full: "🗄️ Complète",
    };
    const typeBadges = {
      data: "bg-info text-dark",
      logs: "bg-warning text-dark",
      full: "bg-success",
    };

    tbody.innerHTML = rules
      .map((rule) => {
        const badge = `<span class="badge ${typeBadges[rule.type] || "bg-secondary"}">${typeLabels[rule.type] || rule.type}</span>`;
        const statusBadge = rule.enabled
          ? '<span class="badge bg-success">✅ Actif</span>'
          : '<span class="badge bg-secondary">⛔ Inactif</span>';
        const lastRun = rule.last_run
          ? new Date(rule.last_run).toLocaleString("fr-FR")
          : "—";
        const nextRun = rule.next_run
          ? new Date(rule.next_run).toLocaleString("fr-FR")
          : "—";
        const lastFile = rule.last_snapshot
          ? rule.last_snapshot.slice(0, 20)
          : "—";
        const toggleLabel = rule.enabled ? "Désactiver" : "Activer";
        const toggleClass = rule.enabled
          ? "btn-outline-warning"
          : "btn-outline-success";

        const intervalMin = rule.interval_minutes || 60;
        const displayInterval =
          intervalMin >= 60
            ? `${Math.round(intervalMin / 60)}h`
            : `${intervalMin}min`;
        return `<tr>
          <td>${badge}</td>
          <td><strong>Toutes les ${displayInterval}</strong></td>
          <td>${statusBadge}</td>
          <td class="small text-muted">${lastRun}<br><span class="text-primary">→ ${nextRun}</span></td>
          <td class="small text-muted">${lastFile}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm ${toggleClass} me-1"
              onclick="AdminBackup.toggleRule('${rule.id}', ${!rule.enabled})">${toggleLabel}</button>
            <button class="btn btn-sm btn-outline-danger"
              onclick="AdminBackup.deleteRule('${rule.id}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
      })
      .join("");
  }

  async function addScheduleRule() {
    const typeEl = document.getElementById("new-rule-type");
    const intervalEl = document.getElementById("new-rule-interval");
    const unitEl = document.getElementById("new-rule-unit");
    const type = typeEl?.value || "full";
    const raw = parseInt(intervalEl?.value || "0", 10);
    const unit = unitEl?.value || "minutes";

    // Convertir en minutes
    const interval = unit === "hours" ? raw * 60 : raw;

    if (isNaN(interval) || interval < 1 || interval > 43200) {
      setStatus("warning", "⚠️ Intervalle invalide (1 min – 30 jours).");
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "add",
          type,
          interval_minutes: interval,
        }),
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus("danger", `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus(
        "success",
        `✅ Planification ajoutée : ${type} toutes les <strong>${interval}min</strong>.`,
      );
      if (intervalEl) intervalEl.value = "";
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    }
  }

  async function deleteRule(id) {
    if (!confirm("Supprimer cette planification ?")) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ action: "delete", id }),
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus("danger", `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus("success", "🗑️ Planification supprimée.");
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    }
  }

  async function toggleRule(id, enabled) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("/admin/api/backup/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ action: "toggle", id, enabled }),
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus("danger", `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus(
        "success",
        enabled ? "✅ Planification activée." : "⛔ Planification désactivée.",
      );
    } catch (e) {
      setStatus("danger", `❌ Erreur réseau : ${e.message}`);
    }
  }

  // ===== HELPERS =====
  function setStatus(type, html) {
    const el = document.getElementById("backup-status");
    if (!el) return;
    el.className = `alert alert-${type} py-2 mb-3`;
    el.innerHTML = html;
    el.classList.remove("d-none");
  }

  function humanSize(b) {
    if (b >= 1024 * 1024 * 1024)
      return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + " MB";
    if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
    return b + " B";
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return {
    load,
    triggerManualBackup,
    refreshBackupList,
    refreshStats,
    downloadSnapshot,
    confirmRestore,

    refreshSchedule,
    addScheduleRule,
    deleteRule,
    toggleRule,
  };
})();
