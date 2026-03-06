/**
 * AdminLogs Module
 * Affiche les logs de l'API en temps réel avec filtres
 */
const AdminLogs = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let autoRefreshTimer = null;
  let autoRefreshEnabled = false;
  const AUTO_REFRESH_INTERVAL = 5000; // 5 secondes

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Token géré via cookie httpOnly — pas besoin de le lire depuis JS

  function levelBadge(level) {
    const map = {
      DEBUG:    ['bg-secondary', 'bi-bug'],
      INFO:     ['bg-info text-dark', 'bi-info-circle'],
      WARN:     ['bg-warning text-dark', 'bi-exclamation-triangle'],
      ERROR:    ['bg-danger', 'bi-x-octagon'],
      SECURITY: ['bg-dark', 'bi-shield-exclamation'],
    };
    const [cls, icon] = map[level] || ['bg-secondary', 'bi-circle'];
    return `<span class="badge ${cls}"><i class="bi ${icon} me-1"></i>${level}</span>`;
  }

  function statusBadge(status) {
    if (!status) return '';
    let cls = 'bg-success';
    if (status >= 500) cls = 'bg-danger';
    else if (status >= 400) cls = 'bg-warning text-dark';
    else if (status >= 300) cls = 'bg-info text-dark';
    return `<span class="badge ${cls}">${status}</span>`;
  }

  function formatTimestamp(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return ts;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Load stats ─────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch('/admin/api/logs/stats', {
        credentials: 'include'
      });
      if (!res.ok) return;
      const stats = await res.json();

      document.getElementById('log-stat-total').textContent  = stats.total  ?? 0;
      document.getElementById('log-stat-info').textContent   = stats.INFO   ?? 0;
      document.getElementById('log-stat-warn').textContent   = stats.WARN   ?? 0;
      document.getElementById('log-stat-error').textContent  = stats.ERROR  ?? 0;
      document.getElementById('log-stat-security').textContent = stats.SECURITY ?? 0;
    } catch (e) {
      console.error('Erreur stats logs:', e);
    }
  }

  // ── Load logs ──────────────────────────────────────────────────────────────
  async function loadLogs() {
    const tbody = document.getElementById('logsTableBody');
    const container = document.getElementById('logsTableContainer');
    const emptyState = document.getElementById('logsEmptyState');

    const level  = document.getElementById('logLevelFilter')?.value || 'ALL';
    const search = document.getElementById('logSearchInput')?.value?.trim() || '';
    const limit  = document.getElementById('logLimitSelect')?.value || '200';

    // Build query
    const params = new URLSearchParams({ limit });
    if (level && level !== 'ALL') params.set('level', level);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/admin/api/logs?${params}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const logs = await res.json();

      if (!logs || logs.length === 0) {
        container.classList.add('d-none');
        emptyState.classList.remove('d-none');
        document.getElementById('log-count').textContent = '0 entrée(s)';
        return;
      }

      container.classList.remove('d-none');
      emptyState.classList.add('d-none');
      document.getElementById('log-count').textContent = `${logs.length} entrée(s)`;

      tbody.innerHTML = logs.map(entry => `
        <tr class="${entry.level === 'ERROR' ? 'table-danger' : entry.level === 'SECURITY' ? 'table-dark' : entry.level === 'WARN' ? 'table-warning' : ''}">
          <td class="text-nowrap small text-muted">${formatTimestamp(entry.timestamp)}</td>
          <td>${levelBadge(entry.level)}</td>
          <td>
            ${entry.method ? `<span class="badge bg-light text-dark border me-1 small">${escapeHtml(entry.method)}</span>` : ''}
            ${entry.path ? `<code class="small">${escapeHtml(entry.path)}</code>` : ''}
            ${!entry.method && !entry.path ? `<span class="text-muted small">—</span>` : ''}
          </td>
          <td class="small">${escapeHtml(entry.message)}</td>
          <td>${statusBadge(entry.status)}</td>
          <td class="small text-muted">${escapeHtml(entry.ip) || '—'}</td>
          <td class="small text-muted">${entry.duration || '—'}</td>
          <td class="small text-muted">${entry.user_id || '—'}</td>
        </tr>
      `).join('');

      await loadStats();
    } catch (e) {
      console.error('Erreur chargement logs:', e);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erreur de chargement des logs</td></tr>`;
    }
  }

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const btn = document.getElementById('autoRefreshBtn');

    if (autoRefreshEnabled) {
      autoRefreshTimer = setInterval(loadLogs, AUTO_REFRESH_INTERVAL);
      btn.classList.replace('btn-outline-secondary', 'btn-success');
      btn.innerHTML = '<i class="bi bi-pause-circle me-1"></i>Auto (ON)';
    } else {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      btn.classList.replace('btn-success', 'btn-outline-secondary');
      btn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Auto refresh';
    }
  }

  // ── Clear logs ─────────────────────────────────────────────────────────────
  async function clearLogs() {
    if (!confirm('Vider tous les logs en mémoire ? Cette action est irréversible.')) return;

    try {
      const res = await fetch('/admin/api/logs', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadLogs();
      AdminUtils.showToast('Logs vidés avec succès', 'success');
    } catch (e) {
      AdminUtils.showToast('Erreur lors de la suppression des logs', 'danger');
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = document.querySelectorAll('#logsTableBody tr');
    if (!rows.length) {
      AdminUtils.showToast('Aucun log à exporter', 'warning');
      return;
    }

    const headers = ['Timestamp', 'Level', 'Method', 'Path', 'Message', 'Status', 'IP', 'Duration', 'UserID'];
    const lines = [headers.join(',')];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const values = [
        cells[0]?.textContent?.trim() || '',
        cells[1]?.textContent?.trim() || '',
        row.querySelector('td:nth-child(3) .badge')?.textContent?.trim() || '',
        row.querySelector('td:nth-child(3) code')?.textContent?.trim() || '',
        cells[3]?.textContent?.trim() || '',
        cells[4]?.textContent?.trim() || '',
        cells[5]?.textContent?.trim() || '',
        cells[6]?.textContent?.trim() || '',
        cells[7]?.textContent?.trim() || '',
      ].map(v => `"${v.replace(/"/g, '""')}"`);
      lines.push(values.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Filtres
    document.getElementById('logLevelFilter')?.addEventListener('change', loadLogs);
    document.getElementById('logLimitSelect')?.addEventListener('change', loadLogs);

    // Recherche avec debounce
    let searchTimeout;
    document.getElementById('logSearchInput')?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadLogs, 300);
    });

    // Boutons
    document.getElementById('refreshLogsBtn')?.addEventListener('click', loadLogs);
    document.getElementById('autoRefreshBtn')?.addEventListener('click', toggleAutoRefresh);
    document.getElementById('clearLogsBtn')?.addEventListener('click', clearLogs);
    document.getElementById('exportLogsBtn')?.addEventListener('click', exportCSV);

    loadLogs();
  }

  // ── Nettoyage quand on quitte la section ───────────────────────────────────
  function destroy() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      autoRefreshEnabled = false;
    }
  }

  return { init, loadLogs, destroy };
})();
