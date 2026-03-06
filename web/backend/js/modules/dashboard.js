/**
 * Dashboard Module — Vue d'ensemble CYNA
 */

const AdminDashboard = {
  revenueChart: null,
  donutChart: null,
  activityChart: null,

  async load() {
    // Date courante
    const el = document.getElementById('dash-date');
    if (el) el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Fetch users une seule fois, partagé entre loadStats et loadRecentUsers
    let usersData = null;
    try {
      const res = await fetch('/admin/api/users', { credentials: 'include' });
      if (res.ok) usersData = await res.json();
    } catch (e) { /* on continue sans users */ }

    await Promise.all([
      this.loadStats(usersData),
      this.loadRecentUsers(usersData),
      this.loadRecentProducts(),
      this.loadSystemStats(),
    ]);
    this.renderRevenueChart();
  },

  async loadStats(usersData) {
    try {
      const [categoriesRes, ordersRes] = await Promise.all([
        fetch('/admin/api/categories', { credentials: 'include' }),
        fetch('/admin/api/orders', { credentials: 'include' }).catch(() => null),
      ]);

      const users      = Array.isArray(usersData) ? usersData : [];
      const categories = categoriesRes.ok ? await categoriesRes.json() : [];
      const orders     = (ordersRes && ordersRes.ok) ? await ordersRes.json() : [];

      const total    = Array.isArray(users) ? users.length : 0;
      const active   = Array.isArray(users) ? users.filter(u => u.status === 'actif' || u.est_actif).length : 0;
      const admins   = Array.isArray(users) ? users.filter(u => u.role === 'admin').length : 0;
      const clients  = total - admins;
      const inactive = total - active;

      const ordersArr = Array.isArray(orders) ? orders : [];
      const totalOrders = ordersArr.length;
      const revenue = ordersArr.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
      const pendingOrders = ordersArr.filter(o => o.status === 'pending' || o.status === 'en_attente').length;

      // Stat cards
      this._setText('dash-total-users', total.toLocaleString('fr-FR'));
      this._setText('dash-active-users', active.toLocaleString('fr-FR'));
      this._setText('dash-total-categories', Array.isArray(categories) ? categories.length : 0);
      this._setText('dash-total-orders', totalOrders.toLocaleString('fr-FR'));
      this._setText('dash-revenue', revenue.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' €');
      this._setText('dash-pending-orders', pendingOrders > 0 ? `⚠️ ${pendingOrders} en attente` : '✅ À jour');
      this._setText('dash-total-admins', admins);

      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      this._setText('dash-active-pct', pct + '%');
      this._setText('dash-active-users2', active.toLocaleString('fr-FR'));
      this._setText('dash-total-users2', total.toLocaleString('fr-FR'));

      this.renderDonutChart(clients, admins, inactive);

      // Graphique activité commandes par mois
      this.renderActivityChart(ordersArr);

    } catch (e) {
      console.error('Dashboard stats error:', e);
    }
  },

  async loadSystemStats() {
    try {
      const [logsRes, backupRes] = await Promise.all([
        fetch('/admin/api/logs/stats', { credentials: 'include' }).catch(() => null),
        fetch('/admin/api/backup/stats', { credentials: 'include' }).catch(() => null),
      ]);

      if (logsRes && logsRes.ok) {
        const stats = await logsRes.json();
        this._setText('dash-log-errors', (stats.ERROR || 0) + (stats.SECURITY ? ` / ${stats.SECURITY} sec.` : ''));
        this._setText('dash-log-total', stats.total || 0);
      }
      if (backupRes && backupRes.ok) {
        const b = await backupRes.json();
        const snaps = b.snapshots_count || 0;
        const size = this._humanSize(b.total_size || 0);
        this._setText('dash-backup-snaps', snaps);
        this._setText('dash-backup-size', size);
      }
    } catch (e) {
      console.error('System stats error:', e);
    }
  },

  async loadRecentUsers(usersData) {
    try {
      const users = Array.isArray(usersData) ? usersData : [];
      const recent = users.length > 0
        ? [...users].sort((a, b) => new Date(b.date_creation || b.createdAt || 0) - new Date(a.date_creation || a.createdAt || 0)).slice(0, 6)
        : [];
      const tbody = document.getElementById('dash-recent-users');
      if (!tbody) return;
      tbody.innerHTML = recent.map(u => {
        const nom = [u.prenom || u.firstName || '', u.nom || u.lastName || ''].filter(Boolean).join(' ') || u.email;
        const date = u.date_creation || u.createdAt;
        return `
        <tr>
          <td class="text-muted small ps-3">#${u.id_utilisateur || u.id}</td>
          <td class="fw-semibold small">${nom}</td>
          <td class="text-muted small d-none d-md-table-cell">${u.email}</td>
          <td><span class="badge ${u.role === 'admin' ? 'bg-warning text-dark badge-admin' : 'bg-secondary'}">${u.role || '—'}</span></td>
          <td class="text-muted small d-none d-lg-table-cell">${date ? new Date(date).toLocaleDateString('fr-FR') : '—'}</td>
          <td><span class="badge ${(u.statut === 'actif' || u.status === 'actif' || u.est_actif) ? 'bg-success' : 'bg-danger'}">${(u.statut === 'actif' || u.status === 'actif' || u.est_actif) ? 'Actif' : 'Inactif'}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" class="text-center text-muted ps-3">Aucun utilisateur</td></tr>';
    } catch (e) {
      console.error('Recent users error:', e);
    }
  },

  async loadRecentProducts() {
    try {
      const res = await fetch('/admin/api/products', { credentials: 'include' });
      if (!res.ok) return;
      const products = await res.json();
      const recent = Array.isArray(products) ? products.slice(0, 6) : [];
      const tbody = document.getElementById('dash-recent-products');
      if (!tbody) return;
      tbody.innerHTML = recent.map(p => `
        <tr>
          <td class="text-muted small ps-3">#${p.id_produit || p.id}</td>
          <td class="fw-semibold small">${p.nom || '—'}</td>
          <td class="text-muted small d-none d-lg-table-cell">${p.id_categorie ? 'Cat. ' + p.id_categorie : '—'}</td>
          <td class="fw-semibold small">${p.prix != null ? parseFloat(p.prix).toLocaleString('fr-FR') + ' €' : '—'}</td>
          <td><span class="badge ${p.actif ? 'bg-success' : 'bg-secondary'}">${p.actif ? 'Actif' : 'Inactif'}</span></td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center text-muted ps-3">Aucun produit</td></tr>';
    } catch (e) {
      console.error('Recent products error:', e);
    }
  },

  renderActivityChart(orders) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    if (this.activityChart) { this.activityChart.destroy(); }

    // Compter les commandes par mois (12 derniers mois)
    const now = new Date();
    const labels = [];
    const counts = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
      counts.push(orders.filter(o => {
        const od = new Date(o.orderDate || o.created_at || 0);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      }).length);
    }

    this.activityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Commandes',
          data: counts,
          borderColor: '#7602F9',
          backgroundColor: 'rgba(118,2,249,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#7602F9',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } },
          y: { beginAtZero: true, ticks: { color: '#6b7280', font: { size: 10 }, stepSize: 1 } }
        }
      }
    });
  },

  renderRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (this.revenueChart) { this.revenueChart.destroy(); }

    const months = ['Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc','Jan','Fév'];
    const data   = [18400, 22100, 19800, 25300, 28700, 24500, 31200, 29800, 33400, 38100, 41200, 42800];

    this.revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'CA (€)',
          data: data,
          backgroundColor: 'rgba(118,2,249,0.75)',
          hoverBackgroundColor: 'rgba(118,2,249,1)',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y.toLocaleString('fr-FR') + ' €' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => (v/1000).toFixed(0) + 'k' }
          }
        }
      }
    });
  },

  renderDonutChart(clients, admins, inactive) {
    const ctx = document.getElementById('donutChart');
    if (!ctx) return;
    if (this.donutChart) { this.donutChart.destroy(); }
    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Clients', 'Admins', 'Inactifs'],
        datasets: [{
          data: [clients || 0, admins || 0, inactive || 0],
          backgroundColor: ['#5610C0', '#7602F9', '#e5e7eb'],
          hoverBackgroundColor: ['#6d22d8', '#8e1cff', '#d1d5db'],
          borderWidth: 0, hoverOffset: 6,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#374151', font: { size: 12 }, padding: 16, usePointStyle: true } }
        }
      }
    });
  },

  _humanSize(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  },

  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
};

window.AdminDashboard = AdminDashboard;
