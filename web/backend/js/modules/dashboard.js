/**
 * Dashboard Module
 * Handles admin dashboard stats, charts and recent data
 */

const AdminDashboard = {
  revenueChart: null,
  donutChart: null,

  async load() {
    await Promise.all([
      this.loadStats(),
      this.loadRecentUsers(),
      this.loadRecentProducts(),
    ]);
    this.renderRevenueChart();
  },

  async loadStats() {
    try {
      const [usersRes, categoriesRes] = await Promise.all([
        fetch('/admin/api/users'),
        fetch('/admin/api/categories'),
      ]);

      const users = usersRes.ok ? await usersRes.json() : [];
      const categories = categoriesRes.ok ? await categoriesRes.json() : [];

      const total   = Array.isArray(users) ? users.length : 0;
      const active  = Array.isArray(users) ? users.filter(u => u.status === 'actif' || u.est_actif).length : 0;
      const admins  = Array.isArray(users) ? users.filter(u => u.role === 'admin').length : 0;
      const clients = total - admins;
      const inactive = total - active;

      // Stat cards
      this._setText('dash-total-users', total.toLocaleString('fr-FR'));
      this._setText('dash-active-users', active.toLocaleString('fr-FR'));
      this._setText('dash-total-categories', Array.isArray(categories) ? categories.length : 0);
      this._setText('dash-total-admins', admins);

      // Percentage active
      const pct = total > 0 ? Math.round((active / total) * 100) : 0;
      this._setText('dash-active-pct', pct + '%');

      // Mirror stats under donut
      this._setText('dash-active-users2', active.toLocaleString('fr-FR'));
      this._setText('dash-total-users2', total.toLocaleString('fr-FR'));

      // Donut chart
      this.renderDonutChart(clients, admins, inactive);

    } catch (e) {
      console.error('Dashboard stats error:', e);
    }
  },

  async loadRecentUsers() {
    try {
      const res = await fetch('/admin/api/users');
      if (!res.ok) return;
      const users = await res.json();
      const recent = Array.isArray(users) ? users.slice(-5).reverse() : [];
      const tbody = document.getElementById('dash-recent-users');
      if (!tbody) return;
      tbody.innerHTML = recent.map(u => `
        <tr>
          <td class="text-muted small">#${u.id_utilisateur}</td>
          <td>${(u.firstName || '') + ' ' + (u.lastName || '') || u.email}</td>
          <td class="text-muted small">${u.email}</td>
          <td><span class="badge ${u.role === 'admin' ? 'bg-warning text-dark' : 'bg-secondary'}">${u.role || '—'}</span></td>
          <td class="text-muted small">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
          <td><span class="badge ${(u.status === 'actif' || u.est_actif) ? 'bg-success' : 'bg-danger'}">${(u.status === 'actif' || u.est_actif) ? 'Actif' : 'Inactif'}</span></td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun utilisateur</td></tr>';
    } catch (e) {
      console.error('Recent users error:', e);
    }
  },

  async loadRecentProducts() {
    try {
      const res = await fetch('/admin/api/products');
      if (!res.ok) return;
      const products = await res.json();
      const recent = Array.isArray(products) ? products.slice(0, 5) : [];
      const tbody = document.getElementById('dash-recent-products');
      if (!tbody) return;
      tbody.innerHTML = recent.map(p => `
        <tr>
          <td class="text-muted small">#${p.id_produit}</td>
          <td>${p.nom || '—'}</td>
          <td class="text-muted small">${p.id_categorie ? 'Cat. ' + p.id_categorie : '—'}</td>
          <td>${p.prix != null ? parseFloat(p.prix).toLocaleString('fr-FR') + ' €' : '—'}</td>
          <td><span class="badge ${p.actif ? 'bg-success' : 'bg-danger'}">${p.actif ? 'Actif' : 'Inactif'}</span></td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center text-muted">Aucun produit</td></tr>';
    } catch (e) {
      console.error('Recent products error:', e);
    }
  },

  renderRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (this.revenueChart) { this.revenueChart.destroy(); }

    // Simulated monthly revenue data
    const months = ['Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc','Jan','Fév'];
    const data   = [18400, 22100, 19800, 25300, 28700, 24500, 31200, 29800, 33400, 38100, 41200, 42800];

    this.revenueChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Chiffre d\'affaires (€)',
          data: data,
          backgroundColor: 'rgba(118, 2, 249, 0.75)',
          hoverBackgroundColor: 'rgba(118, 2, 249, 1)',
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + ctx.parsed.y.toLocaleString('fr-FR') + ' €'
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              color: '#6b7280',
              font: { size: 11 },
              callback: v => (v / 1000).toFixed(0) + 'k €'
            }
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
          backgroundColor: ['#5610C0', '#7602F9', '#351E90'],
          hoverBackgroundColor: ['#6d22d8', '#8e1cff', '#4a2bb5'],
          borderWidth: 0,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#374151', font: { size: 12 }, padding: 16, usePointStyle: true }
          }
        }
      }
    });
  },

  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
};

window.AdminDashboard = AdminDashboard;
