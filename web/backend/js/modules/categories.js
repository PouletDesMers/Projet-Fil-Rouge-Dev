/**
 * Categories Module
 * Handles category management in admin panel
 */

// Fix duplicate orders in categories
async function fixDuplicateCategoryOrders(categories) {
  
  
  // Sort categories by their current order first, then by ID as fallback
  categories.sort((a, b) => {
    const orderA = a.ordre_affichage || 999;
    const orderB = b.ordre_affichage || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If same order, sort by ID (older categories first)
    return a.id_categorie - b.id_categorie;
  });
  
  // Reassign clean sequential orders: 1, 2, 3, ...
  let needsUpdate = false;
  const updatePromises = [];
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const expectedOrder = i + 1;
    
    if (category.ordre_affichage !== expectedOrder) {
      needsUpdate = true;
      
      const updateData = {
        ...category,
        ordre_affichage: expectedOrder
      };
      
      updatePromises.push(
        fetch(`/admin/api/categories/${category.id_categorie}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        }).then(response => {
          if (response.ok) {
            // Update local data
            category.ordre_affichage = expectedOrder;
          } else {
            console.warn(`Erreur lors de la mise à jour de l'ordre de la catégorie ${category.id_categorie}`);
          }
        }).catch(error => {
          console.warn(`Erreur lors de la correction de l'ordre de la catégorie ${category.id_categorie}:`, error);
        })
      );
    }
  }
  
  // Wait for all updates to complete
  if (needsUpdate && updatePromises.length > 0) {
    try {
      await Promise.all(updatePromises);
      console.log(`Ordres d'affichage recalculés pour ${updatePromises.length} catégories (séquence 1-2-3...)`);
    } catch (error) {
      console.warn('Erreur lors de la correction des ordres:', error);
    }
  }
}

// Load categories from API
async function loadCategories() {
  try {
    
    const categoriesContainer = document.getElementById('categoriesContainer');

    categoriesContainer.innerHTML =
      '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/categories');

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();

    if (!categories || categories.length === 0) {
      categoriesContainer.innerHTML =
        '<div class="alert alert-info">Aucune catégorie trouvée</div>';
      return;
    }

    // Fix duplicate orders before sorting
    await fixDuplicateCategoryOrders(categories);

    // Sort by order
    categories.sort((a, b) => (a.ordre_affichage || 999) - (b.ordre_affichage || 999));

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Icône</th>
              <th>Couleur</th>
              <th>Ordre</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories
              .map(
                (cat, index) => `
              <tr>
                <td><code>${cat.id_categorie}</code></td>
                <td><strong>${cat.nom}</strong></td>
                <td><code>${cat.slug}</code></td>
                <td>${cat.description ? cat.description.substring(0, 50) + (cat.description.length > 50 ? '...' : '') : '-'}</td>
                <td><i class="${cat.icone}" style="color: ${cat.couleur}"></i> <small>${cat.icone}</small></td>
                <td><span class="badge" style="background-color: ${cat.couleur};">${cat.couleur}</span></td>
                <td>${cat.ordre_affichage}</td>
                <td>
                  <span class="badge ${cat.actif ? 'bg-success' : 'bg-secondary'}">
                    ${cat.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td class="table-actions">
                  <div class="btn-group" role="group">
                    ${index > 0 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminCategories.moveCategory(${cat.id_categorie}, 'up')" title="Déplacer vers le haut">
                      <i class="bi bi-arrow-up"></i>
                    </button>` : ''}
                    ${index < categories.length - 1 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminCategories.moveCategory(${cat.id_categorie}, 'down')" title="Déplacer vers le bas">
                      <i class="bi bi-arrow-down"></i>
                    </button>` : ''}
                  </div>
                  <button class="btn btn-outline-success btn-sm me-2 ms-2" onclick="AdminMain.showCategoryProducts(${cat.id_categorie}, '${cat.nom}')" title="Gérer les produits">
                    <i class="bi bi-box"></i>
                  </button>
                  <button class="btn btn-outline-primary btn-sm me-2" onclick="AdminCategories.editCategory(${cat.id_categorie})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-outline-${cat.actif ? 'warning' : 'success'} btn-sm me-2" onclick="AdminCategories.toggleCategoryStatus(${cat.id_categorie}, ${!cat.actif})">
                    <i class="bi bi-${cat.actif ? 'eye-slash' : 'eye'}"></i>
                  </button>
                  <button class="btn btn-outline-danger btn-sm" onclick="AdminCategories.deleteCategory(${cat.id_categorie}, '${cat.nom}')">
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    categoriesContainer.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur:', error);
    const categoriesContainer = document.getElementById('categoriesContainer');
    categoriesContainer.innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des catégories</div>';
  }
}

// Open category modal
function openCategoryModal(category = null) {
  const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
  const titleText = document.getElementById('categoryModalTitleText');
  const saveBtn = document.getElementById('saveCategoryBtnText');
  const form = document.getElementById('categoryForm');

  form.reset();

  if (category) {
    titleText.textContent = 'Modifier Catégorie';
    saveBtn.textContent = 'Modifier';
    
    document.getElementById('categoryId').value = category.id_categorie;
    document.getElementById('categoryNom').value = category.nom;
    document.getElementById('categorySlug').value = category.slug;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryIcone').value = category.icone || 'bi bi-tag';
    document.getElementById('categoryCouleur').value = category.couleur || '#7602F9';
    document.getElementById('categoryOrder').value = category.ordre_affichage || 1;
    document.getElementById('categoryActive').checked = category.actif;
  } else {
    titleText.textContent = 'Ajouter Catégorie';
    saveBtn.textContent = 'Ajouter';
    
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryIcone').value = 'bi bi-tag';
    document.getElementById('categoryCouleur').value = '#7602F9';
    document.getElementById('categoryOrder').value = '1';
    document.getElementById('categoryActive').checked = true;
  }

  modal.show();
}

// Save category
async function saveCategory() {
  try {
    
    const categoryId = document.getElementById('categoryId').value;
    const isEdit = Boolean(categoryId);

    const categoryData = {
      nom: document.getElementById('categoryNom').value,
      slug: document.getElementById('categorySlug').value,
      description: document.getElementById('categoryDescription').value,
      icone: document.getElementById('categoryIcone').value || 'bi bi-tag',
      couleur: document.getElementById('categoryCouleur').value,
      ordre_affichage: parseInt(document.getElementById('categoryOrder').value) || 1,
      actif: document.getElementById('categoryActive').checked
    };

    const url = isEdit ? `/admin/api/categories/${categoryId}` : '/admin/api/categories';
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoryData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
    modal.hide();

    AdminUtils.showToast(
      isEdit ? 'Catégorie modifiée avec succès !' : 'Catégorie ajoutée avec succès !',
      'success'
    );
    loadCategories();
    
    // Also reload categories for products if we're adding from product modal
    const productModal = document.getElementById('productModal');
    if (productModal && productModal.classList.contains('show')) {
      loadCategoriesForProducts();
    }
  } catch (error) {
    console.error('Erreur:', error);
    AdminUtils.showToast('Erreur: ' + error.message, 'error');
  }
}

// Load categories for product dropdown
async function loadCategoriesForProducts() {
  try {
    

    const response = await fetch('/admin/api/categories', {
      headers: {
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();
    const select = document.getElementById('productCategorie');
    
    if (select) {
      select.innerHTML = '<option value="">Sélectionner une catégorie</option>' +
        categories.map(cat => `<option value="${cat.id_categorie}">${cat.nom}</option>`).join('');
    }

    // Also load categories for filter dropdown
    const filterSelect = document.getElementById('categoryFilter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Toutes les catégories</option>' +
        categories.map(cat => `<option value="${cat.id_categorie}">${cat.nom}</option>`).join('');
    }

  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error);
  }
}

// Move category
async function moveCategory(categoryId, direction) {
  try {
    

    // Use client-side implementation
    await AdminProducts.moveItemClientSide('category', categoryId, direction);
  } catch (error) {
    console.error(`Erreur lors du déplacement de la catégorie:`, error);
    AdminUtils.showAlert(`Erreur lors du déplacement: ${error.message}`, 'danger');
  }
}

// Edit category
async function editCategory(categoryId) {
  try {
    
    
    const response = await fetch('/admin/api/categories', {
      headers: {
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des catégories');
    }

    const categories = await response.json();
    const category = categories.find(cat => cat.id_categorie == categoryId);

    if (!category) {
      throw new Error('Catégorie introuvable');
    }

    openCategoryModal(category);
  } catch (error) {
    AdminUtils.showToast('Erreur: ' + error.message, 'error');
  }
}

// Toggle category status
async function toggleCategoryStatus(categoryId, newStatus) {
  AdminUtils.showToast('Fonctionnalité en développement', 'info');
}

// Delete category
async function deleteCategory(categoryId, categoryName) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categoryName}" ?`)) {
    return;
  }

  AdminUtils.showToast('Fonctionnalité de suppression en développement', 'info');
}

// Export functions
window.AdminCategories = {
  loadCategories,
  openCategoryModal,
  saveCategory,
  loadCategoriesForProducts,
  moveCategory,
  editCategory,
  toggleCategoryStatus,
  deleteCategory,
  fixDuplicateCategoryOrders
};