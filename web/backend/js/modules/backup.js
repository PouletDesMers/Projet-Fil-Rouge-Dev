// ============================================================
// Module : Sauvegardes Restic de la base de données
// ============================================================
// Restic = déduplication + chiffrement AES-256 + snapshots
// Types : "data" (sans logs) | "logs" (api_logs seulement) | "full" (tout)

const AdminBackup = (() => {
  let backupInProgress = false;

  // ===== INIT =====
  async function load() {
    await Promise.all([refreshBackupList(), refreshSchedule(), refreshStats()]);
  }

  // ===== BACKUP MANUEL =====
  async function triggerManualBackup(backupType) {
    if (backupInProgress) return;

    // Si pas de type passé, lire depuis le select
    if (!backupType) {
      const sel = document.getElementById('backup-type-select');
      backupType = sel ? sel.value : 'full';
    }

    const btn = document.getElementById('btn-manual-backup');
    backupInProgress = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Snapshot en cours…';
    }
    const typeLabel = { data: 'données', logs: 'logs', full: 'complet' }[backupType] || backupType;
    setStatus('info', `⏳ Création du snapshot Restic (${typeLabel}) en cours…`);

    try {
      const resp = await fetch('/admin/api/backup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: backupType }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setStatus('danger', `❌ Échec : ${data.error || resp.statusText}`);
        return;
      }
      const shortId = (data.snapshot_id || '').slice(0, 8);
      setStatus('success', `✅ Snapshot <strong>${typeLabel}</strong> créé ! <strong>ID : ${shortId}</strong> — Dédupliqué et chiffré AES-256.`);
      await Promise.all([refreshBackupList(), refreshStats()]);
    } catch (e) {
      setStatus('danger', `❌ Erreur réseau : ${e.message}`);
    } finally {
      backupInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Créer un snapshot';
      }
    }
  }

  // ===== LISTE DES SNAPSHOTS =====
  async function refreshBackupList() {
    const tbody = document.getElementById('backup-files-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</td></tr>';

    try {
      const resp = await fetch('/admin/api/backup/list', { credentials: 'include' });
      if (!resp.ok) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur ${resp.status}</td></tr>`;
        return;
      }
      const data = await resp.json();
      const snapshots = data.snapshots || [];

      if (snapshots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted fst-italic py-3">Aucun snapshot — créez votre premier backup</td></tr>';
        return;
      }

      tbody.innerHTML = snapshots.map(s => {
        const shortId = (s.short_id || s.id || '').slice(0, 8);
        const date = new Date(s.time).toLocaleString('fr-FR');
        const tags = s.tags || [];

        // Badge type de backup
        const typeTag = tags.find(t => ['data', 'logs', 'full'].includes(t)) || 'full';
        const typeColor = { data: 'info', logs: 'warning', full: 'success' }[typeTag] || 'secondary';
        const typeLabel = { data: 'Données', logs: 'Logs', full: 'Complet' }[typeTag] || typeTag;
        const typeBadge = `<span class="badge bg-${typeColor} me-1">${typeLabel}</span>`;

        // Badge auto/manuel
        const modeBadge = tags.includes('auto')
          ? '<span class="badge bg-primary me-1">auto</span>'
          : '<span class="badge bg-secondary me-1">manuel</span>';

        return `
          <tr>
            <td><code class="text-primary">${esc(shortId)}</code></td>
            <td>${date}</td>
            <td>${typeBadge}${modeBadge}</td>
            <td>${esc(s.hostname || '—')}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary me-1" onclick="AdminBackup.downloadSnapshot('${esc(s.id || s.short_id)}')" title="Télécharger le SQL">
                <i class="bi bi-download"></i>
              </button>
              <button class="btn btn-sm btn-outline-warning me-1" onclick="AdminBackup.confirmRestore('${esc(s.id || s.short_id)}')" title="Restaurer">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="AdminBackup.confirmDelete('${esc(s.id || s.short_id)}')" title="Supprimer">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur : ${e.message}</td></tr>`;
    }
  }

  // ===== STATS RESTIC =====
  async function refreshStats() {
    try {
      const resp = await fetch('/admin/api/backup/stats', { credentials: 'include' });
      if (!resp.ok) return;
      const stats = await resp.json();

      const elSize = document.getElementById('backup-repo-size');
      const elCount = document.getElementById('backup-snap-count');
      const elFiles = document.getElementById('backup-file-count');

      if (elSize) elSize.textContent = humanSize(stats.total_size || 0);
      if (elCount) elCount.textContent = stats.snapshots_count ?? '—';
      if (elFiles) elFiles.textContent = stats.total_file_count ?? '—';
    } catch (e) {
      console.error('refreshStats:', e);
    }
  }

  // ===== TÉLÉCHARGER UN SNAPSHOT =====
  async function downloadSnapshot(snapshotId) {
    setStatus('info', `⏳ Export du snapshot ${snapshotId.slice(0, 8)}…`);
    const url = `/admin/api/backup/download?snapshot=${encodeURIComponent(snapshotId)}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) {
      setStatus('danger', `❌ Export impossible : ${resp.statusText}`);
      return;
    }
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `restic-dump-${snapshotId.slice(0, 8)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus('success', `✅ Export SQL du snapshot ${snapshotId.slice(0, 8)} téléchargé.`);
  }

  // ===== RESTAURER UN SNAPSHOT =====
  async function confirmRestore(snapshotId) {
    const shortId = snapshotId.slice(0, 8);
    if (!confirm(`⚠️ RESTAURER le snapshot ${shortId} ?\n\nCeci va ÉCRASER les données actuelles avec ce snapshot.\n⚠️ Toutes les modifications depuis ce snapshot seront perdues.\n\nConfirmer ?`)) return;

    setStatus('warning', `⏳ Restauration du snapshot ${shortId} en cours…`);
    try {
      const resp = await fetch('/admin/api/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_id: snapshotId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus('danger', `❌ Restauration échouée : ${data.error}`);
        return;
      }
      const typeLabel = data.backup_type ? ` (type: ${data.backup_type})` : '';
      setStatus('success', `✅ Base de données restaurée depuis le snapshot <strong>${shortId}</strong>${typeLabel} avec succès !`);
      await refreshBackupList();
    } catch (e) {
      setStatus('danger', `❌ Erreur réseau : ${e.message}`);
    }
  }

  // ===== SUPPRIMER UN SNAPSHOT =====
  async function confirmDelete(snapshotId) {
    const shortId = snapshotId.slice(0, 8);
    if (!confirm(`Supprimer le snapshot ${shortId} ?\nCette action est irréversible.`)) return;
    try {
      const resp = await fetch(`/admin/api/backup?snapshot=${encodeURIComponent(snapshotId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus('danger', `❌ Erreur suppression : ${err.error || resp.statusText}`);
        return;
      }
      setStatus('success', `🗑️ Snapshot <strong>${shortId}</strong> supprimé.`);
      await Promise.all([refreshBackupList(), refreshStats()]);
    } catch (e) {
      setStatus('danger', `❌ Erreur réseau : ${e.message}`);
    }
  }

  // ===== PLANIFICATIONS MULTIPLES =====
  async function refreshSchedule() {
    try {
      const resp = await fetch('/admin/api/backup/schedule', { credentials: 'include' });
      if (!resp.ok) return;
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
    } catch (e) { console.error('refreshSchedule:', e); }
  }

  function renderScheduleRules(rules) {
    const tbody = document.getElementById('schedule-rules-body');
    if (!tbody) return;

    if (!rules.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">
        <i class="bi bi-calendar-x me-2"></i>Aucune planification configurée
      </td></tr>`;
      return;
    }

    const typeLabels = { data: '💾 Données', logs: '📋 Logs', full: '🗄️ Complète' };
    const typeBadges = { data: 'bg-info text-dark', logs: 'bg-warning text-dark', full: 'bg-success' };

    tbody.innerHTML = rules.map(rule => {
      const badge = `<span class="badge ${typeBadges[rule.type] || 'bg-secondary'}">${typeLabels[rule.type] || rule.type}</span>`;
      const statusBadge = rule.enabled
        ? '<span class="badge bg-success">✅ Actif</span>'
        : '<span class="badge bg-secondary">⛔ Inactif</span>';
      const lastRun = rule.last_run ? new Date(rule.last_run).toLocaleString('fr-FR') : '—';
      const nextRun = rule.next_run ? new Date(rule.next_run).toLocaleString('fr-FR') : '—';
      const snap    = rule.last_snapshot ? rule.last_snapshot.slice(0,8) : '—';
      const toggleLabel = rule.enabled ? 'Désactiver' : 'Activer';
      const toggleClass = rule.enabled ? 'btn-outline-warning' : 'btn-outline-success';

      return `<tr>
        <td>${badge}</td>
        <td><strong>Toutes les ${rule.interval_hours}h</strong></td>
        <td>${statusBadge}</td>
        <td class="small text-muted">${lastRun}<br><span class="text-primary">→ ${nextRun}</span></td>
        <td class="small text-muted">${snap}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm ${toggleClass} me-1"
            onclick="AdminBackup.toggleRule('${rule.id}', ${!rule.enabled})">${toggleLabel}</button>
          <button class="btn btn-sm btn-outline-danger"
            onclick="AdminBackup.deleteRule('${rule.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function addScheduleRule() {
    const typeEl     = document.getElementById('new-rule-type');
    const intervalEl = document.getElementById('new-rule-interval');
    const type     = typeEl?.value || 'full';
    const interval = parseInt(intervalEl?.value || '0', 10);

    if (isNaN(interval) || interval < 1 || interval > 720) {
      setStatus('warning', '⚠️ Intervalle invalide (1–720 heures).');
      return;
    }
    try {
      const resp = await fetch('/admin/api/backup/schedule', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', type, interval_hours: interval }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus('danger', `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus('success', `✅ Planification ajoutée : ${type} toutes les <strong>${interval}h</strong>.`);
      if (intervalEl) intervalEl.value = '';
    } catch (e) { setStatus('danger', `❌ Erreur réseau : ${e.message}`); }
  }

  async function deleteRule(id) {
    if (!confirm('Supprimer cette planification ?')) return;
    try {
      const resp = await fetch('/admin/api/backup/schedule', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus('danger', `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus('success', '🗑️ Planification supprimée.');
    } catch (e) { setStatus('danger', `❌ Erreur réseau : ${e.message}`); }
  }

  async function toggleRule(id, enabled) {
    try {
      const resp = await fetch('/admin/api/backup/schedule', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id, enabled }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStatus('danger', `❌ Erreur : ${err.error || resp.statusText}`);
        return;
      }
      const data = await resp.json();
      renderScheduleRules(data.rules || []);
      setStatus('success', enabled ? '✅ Planification activée.' : '⛔ Planification désactivée.');
    } catch (e) { setStatus('danger', `❌ Erreur réseau : ${e.message}`); }
  }

  // ===== HELPERS =====
  function setStatus(type, html) {
    const el = document.getElementById('backup-status');
    if (!el) return;
    el.className = `alert alert-${type} py-2`;
    el.innerHTML = html;
    el.classList.remove('d-none');
  }

  function humanSize(b) {
    if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  return {
    load, triggerManualBackup, refreshBackupList, refreshStats,
    downloadSnapshot, confirmRestore, confirmDelete,
    refreshSchedule, addScheduleRule, deleteRule, toggleRule
  };
})();
