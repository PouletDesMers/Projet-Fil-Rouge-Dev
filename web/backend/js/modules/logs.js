/**
 * AdminLogs Module
 * Affiche les logs de l'API en temps réel avec filtres enrichis
 */
const AdminLogs = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let autoRefreshTimer = null;
  let autoRefreshEnabled = false;
  const AUTO_REFRESH_INTERVAL = 5000;

  // ── Helpers ────────────────────────────────────────────────────────────────
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
      return new Date(ts).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return ts; }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Load stats ─────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch('/admin/api/logs/stats', { credentials: 'include' });
      if (!res.ok) return;
      const s = await res.json();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? 0; };
      set('log-stat-total',    s.total);
      set('log-stat-info',     s.INFO);
      set('log-stat-warn',     s.WARN);
      set('log-stat-error',    s.ERROR);
      set('log-stat-security', s.SECURITY);
    } catch (e) { console.error('Erreur stats logs:', e); }
  }

  // ── Load logs ──────────────────────────────────────────────────────────────
  async function loadLogs() {
    const tbody      = document.getElementById('logsTableBody');
    const container  = document.getElementById('logsTableContainer');
    const emptyState = document.getElementById('logsEmptyState');

    const level    = document.getElementById('logLevelFilter')?.value  || 'ALL';
    const method   = document.getElementById('logMethodFilter')?.value || '';
    const statusF  = document.getElementById('logStatusFilter')?.value || '';
    const search   = document.getElementById('logSearchInput')?.value?.trim() || '';
    const limit    = document.getElementById('logLimitSelect')?.value  || '200';
    const dateFrom = document.getElementById('logDateFrom')?.value     || '';
    const dateTo   = document.getElementById('logDateTo')?.value       || '';

    const params = new URLSearchParams({ limit });
    if (level && level !== 'ALL') params.set('level', level);
    if (search)   params.set('search', search);
    if (method)   params.set('method', method);
    if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
    if (dateTo)   params.set('date_to',   new Date(dateTo).toISOString());

    try {
      const res = await fetch(`/admin/api/logs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let logs = await res.json();
      if (!Array.isArray(logs)) logs = [];

      // Filtre statut HTTP côté client (plus simple que d'étendre l'API)
      if (statusF) {
        const min = parseInt(statusF);
        logs = logs.filter(e => e.status >= min && e.status < min + 100);
      }

      if (logs.length === 0) {
        container.classList.add('d-none');
        emptyState.classList.remove('d-none');
        document.getElementById('log-count').textContent = '0 entrée(s)';
        return;
      }

      container.classList.remove('d-none');
      emptyState.classList.add('d-none');
      document.getElementById('log-count').textContent = `${logs.length} entrée(s)`;

      const methodColors = {
        GET: 'bg-success', POST: 'bg-primary', PUT: 'bg-warning text-dark',
        PATCH: 'bg-warning text-dark', DELETE: 'bg-danger', OPTIONS: 'bg-secondary'
      };

      tbody.innerHTML = logs.map(e => {
        const rowClass = e.level === 'ERROR' ? 'table-danger'
          : e.level === 'SECURITY' ? 'table-dark text-white'
          : e.level === 'WARN' ? 'table-warning' : '';

        const methodBadge = e.method
          ? `<span class="badge ${methodColors[e.method] || 'bg-secondary'} me-1">${escapeHtml(e.method)}</span>`
          : '';

        const pathText = e.path
          ? `<code class="small text-break">${escapeHtml(e.path)}</code>`
          : '<span class="text-muted">—</span>';

        const userText = (e.user_id != null && e.user_id !== 0)
          ? `<span class="badge bg-light text-dark border">👤 ${e.user_id}</span>`
          : '<span class="text-muted small">—</span>';

        return `<tr class="${rowClass}">
          <td class="text-nowrap small text-muted">${formatTimestamp(e.timestamp)}</td>
          <td>${levelBadge(e.level)}</td>
          <td class="text-nowrap">${methodBadge}${pathText}</td>
          <td>${statusBadge(e.status)}</td>
          <td><span class="small">${escapeHtml(e.message) || '—'}</span></td>
          <td class="small text-muted text-nowrap">${escapeHtml(e.ip) || '—'}</td>
          <td class="small text-muted text-nowrap">${e.duration || '—'}</td>
          <td>${userText}</td>
        </tr>`;
      }).join('');

      await loadStats();
    } catch (e) {
      console.error('Erreur chargement logs:', e);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erreur de chargement des logs</td></tr>`;
    }
  }

  // ── Reset filtres ──────────────────────────────────────────────────────────
  function resetFilters() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('logLevelFilter',  'ALL');
    set('logMethodFilter', '');
    set('logStatusFilter', '');
    set('logLimitSelect',  '200');
    set('logSearchInput',  '');
    set('logDateFrom',     '');
    set('logDateTo',       '');
    loadLogs();
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
      const res = await fetch('/admin/api/logs', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadLogs();
      AdminUtils.showToast('Logs vidés avec succès', 'success');
    } catch { AdminUtils.showToast('Erreur lors de la suppression des logs', 'danger'); }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = document.querySelectorAll('#logsTableBody tr');
    if (!rows.length) { AdminUtils.showToast('Aucun log à exporter', 'warning'); return; }
    const headers = ['Timestamp', 'Level', 'Method', 'Path', 'Status', 'Message', 'IP', 'Duration', 'UserID'];
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
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `api-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Debounce partagé pour tous les filtres (évite les rafales → 429)
    let filterTimeout;
    function debouncedLoad() {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(loadLogs, 400);
    }

    // Filtres selects + dates
    ['logLevelFilter', 'logMethodFilter', 'logStatusFilter', 'logLimitSelect',
     'logDateFrom', 'logDateTo'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', debouncedLoad);
    });

    // Recherche texte
    document.getElementById('logSearchInput')?.addEventListener('input', debouncedLoad);

    // Boutons
    document.getElementById('refreshLogsBtn')?.addEventListener('click', loadLogs);
    document.getElementById('autoRefreshBtn')?.addEventListener('click', toggleAutoRefresh);
    document.getElementById('clearLogsBtn')?.addEventListener('click', clearLogs);
    document.getElementById('exportLogsBtn')?.addEventListener('click', exportCSV);
    document.getElementById('logResetFilters')?.addEventListener('click', resetFilters);

    loadLogs();
  }

  function destroy() {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; autoRefreshEnabled = false; }
  }

  return { init, loadLogs, destroy };
})();
