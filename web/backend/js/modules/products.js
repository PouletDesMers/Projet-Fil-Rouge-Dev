/**
 * Products Module
 * Handles product management in admin panel
 */

// ── Module-level state ───────────────────────────────────────────────────────
let quillEditor = null;
let productImagesList = [];

function buildProductHeaders(includeJson = false) {
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const token = AdminAuth?.getAuthToken?.();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Initialize Quill editor once (called when modal is first shown).
 * Quill v2 requires the container to be visible in the DOM.
 */
function initQuillOnce() {
  if (quillEditor) return;
  const editorEl = document.getElementById('quill-editor');
  if (!editorEl) return;
  quillEditor = new Quill('#quill-editor', {
    theme: 'snow',
    modules: { toolbar: '#quill-toolbar' }
  });
}

// ── Image helpers ─────────────────────────────────────────────────────────────

/** Render thumbnail strip in #productImagesPreview */
function renderImagesPreview() {
  const el = document.getElementById('productImagesPreview');
  if (!el) return;
  if (productImagesList.length === 0) {
    el.innerHTML = '<span class="text-muted small fst-italic">Aucune image pour l\'instant</span>';
    return;
  }
  el.innerHTML = productImagesList.map((url, i) => `
    <div class="position-relative d-inline-block">
      <img src="${url}" alt="Image ${i + 1}"
           style="width:80px;height:60px;object-fit:cover;border-radius:6px;
                  border:2px solid ${i === 0 ? '#5610C0' : '#dee2e6'}">
      <button type="button" onclick="AdminProducts.removeImage(${i})"
        class="btn btn-danger btn-sm position-absolute top-0 end-0 p-0"
        style="width:18px;height:18px;font-size:10px;line-height:1;transform:translate(50%,-50%)">✕</button>
      ${i === 0 ? '<span class="badge bg-primary position-absolute bottom-0 start-0 m-1" style="font-size:9px">Principale</span>' : ''}
    </div>`).join('');
}

/** Add image from the URL text input */
function addImageUrl() {
  const input = document.getElementById('productImageUrl');
  const url = (input.value || '').trim();
  if (!url) return;
  productImagesList.push(url);
  document.getElementById('productImages').value = JSON.stringify(productImagesList);
  input.value = '';
  renderImagesPreview();
}

/** Upload an image file to /api/upload and add the returned URL */
async function uploadImage(input) {
  if (!input.files || !input.files.length) return;
  const fd = new FormData();
  fd.append('file', input.files[0]);
  try {
    const res = await fetch('/admin/api/upload', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
    const data = await res.json();
    if (data.url) {
      productImagesList.push(data.url);
      document.getElementById('productImages').value = JSON.stringify(productImagesList);
      renderImagesPreview();
    } else {
      throw new Error('URL non retournée par le serveur');
    }
  } catch (e) {
    alert('Erreur upload : ' + e.message);
  }
  input.value = '';
}

/** Remove one image by its index in the list */
function removeImage(index) {
  productImagesList.splice(index, 1);
  document.getElementById('productImages').value = JSON.stringify(productImagesList);
  renderImagesPreview();
}

// ─────────────────────────────────────────────────────────────────────────────

// Fix duplicate orders in products
async function fixDuplicateOrders(products) {
  
  
  // Sort products by their current order first, then by creation date as fallback
  products.sort((a, b) => {
    const orderA = a.ordre_affichage || 999;
    const orderB = b.ordre_affichage || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If same order, sort by ID (older products first)
    return a.id_produit - b.id_produit;
  });
  
  // Reassign clean sequential orders: 1, 2, 3, ...
  let needsUpdate = false;
  const updatePromises = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const expectedOrder = i + 1;
    
    if (product.ordre_affichage !== expectedOrder) {
      needsUpdate = true;
      
      const updateData = {
        ...product,
        ordre_affichage: expectedOrder
      };
      
      updatePromises.push(
        fetch(`/admin/api/products/${product.id_produit}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        }).then(response => {
          if (response.ok) {
            // Update local data
            product.ordre_affichage = expectedOrder;
          } else {
            console.warn(`Erreur lors de la mise à jour de l'ordre du produit ${product.id_produit}`);
          }
        }).catch(error => {
          console.warn(`Erreur lors de la correction de l'ordre du produit ${product.id_produit}:`, error);
        })
      );
    }
  }
  
  // Wait for all updates to complete
  if (needsUpdate && updatePromises.length > 0) {
    try {
      await Promise.all(updatePromises);
      console.log(`Ordres d'affichage recalculés pour ${updatePromises.length} produits (séquence 1-2-3...)`);
    } catch (error) {
      console.warn('Erreur lors de la correction des ordres:', error);
    }
  }
}

// Load products for current category
async function loadCategoryProducts() {
  const currentCategoryId = AdminMain.currentCategoryId();
  if (!currentCategoryId) return;

  try {

    const container = document.getElementById('categoryProductsContainer');
    if (!container) return; // Guard clause

    container.innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></div>';

    const response = await fetch('/admin/api/products', {
      headers: buildProductHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des produits');
    }

    let products = await response.json();
    
    // Filter products by current category
    products = products.filter(product => 
      product.id_categorie && product.id_categorie.toString() === currentCategoryId.toString()
    );

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> 
          Aucun produit trouvé pour la catégorie "${AdminMain.currentCategoryName()}".
          <br>
          <button class="btn btn-primary btn-sm mt-2" onclick="AdminProducts.openProductModal(null, ${currentCategoryId})">
            <i class="bi bi-plus-circle"></i> Ajouter le premier produit
          </button>
        </div>
      `;
      return;
    }

    // Fix duplicate orders before sorting
    await fixDuplicateOrders(products);

    // Sort by order
    products.sort((a, b) => (a.ordre_affichage || 999) - (b.ordre_affichage || 999));

    const tableHTML = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Prix</th>
              <th>Tag</th>
              <th>Statut</th>
              <th>Type</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                (product, index) => `
              <tr>
                <td><span class="badge bg-secondary">${product.ordre_affichage || 1}</span></td>
                <td>
                  <strong>${product.nom}</strong><br>
                  <small class="text-muted">${product.slug}</small>
                </td>
                <td>
                  ${product.prix ? `${product.prix} ${product.devise}` : 'Sur devis'}
                  <br><small class="text-muted">par ${product.duree}</small>
                </td>
                <td>
                  <span class="badge ${AdminUtils.getTagColor(product.tag)}">${product.tag || 'Standard'}</span>
                </td>
                <td>
                  <span class="badge ${AdminUtils.getStatusColor(product.statut)}">${product.statut || 'Disponible'}</span>
                </td>
                <td>
                  <span class="badge ${product.type_achat === 'devis' ? 'bg-info' : 'bg-success'}">${product.type_achat || 'panier'}</span>
                </td>
                <td>
                  <span class="badge ${product.actif ? 'bg-success' : 'bg-danger'}">${
                  product.actif ? 'Actif' : 'Inactif'
                }</span>
                </td>
                <td>
                  <div class="btn-group" role="group">
                    ${index > 0 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminProducts.moveProduct(${product.id_produit}, 'up')" title="Déplacer vers le haut">
                      <i class="bi bi-arrow-up"></i>
                    </button>` : ''}
                    ${index < products.length - 1 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminProducts.moveProduct(${product.id_produit}, 'down')" title="Déplacer vers le bas">
                      <i class="bi bi-arrow-down"></i>
                    </button>` : ''}
                  </div>
                  <button class="btn btn-sm btn-outline-primary me-1 ms-2" onclick="AdminProducts.openProductModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="AdminProducts.deleteProduct(${product.id_produit})">
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

    container.innerHTML = tableHTML;
  } catch (error) {
    console.error('Erreur lors du chargement des produits:', error);
    document.getElementById('categoryProductsContainer').innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des produits: ' + error.message + '</div>';
  }
}

// Open product modal
function openProductModal(product = null, preselectedCategoryId = null) {
  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  const titleText = document.getElementById('productModalTitleText');
  const saveBtn = document.getElementById('saveProductBtnText');
  const categorieContainer = document.getElementById('productCategorieContainer');
  const orderContainer = document.getElementById('productOrderContainer');
  const selectedCategoryInfo = document.getElementById('selectedCategoryInfo');
  const categorySelect = document.getElementById('productCategorie');
  const nomInput = document.getElementById('productNom');
  const form = document.getElementById('productForm');

  form.reset();

  if (product) {
    // Edit mode - show all fields
    titleText.textContent = 'Modifier Produit';
    saveBtn.textContent = 'Modifier';
    
    document.getElementById('productId').value = product.id_produit;
    document.getElementById('productNom').value = product.nom;
    document.getElementById('productSlug').value = product.slug;
    document.getElementById('productDescCourte').value = product.description_courte || '';
    document.getElementById('productDescLongue').value = product.description_longue || '';
    document.getElementById('productCategorie').value = product.id_categorie || '';
    document.getElementById('productTag').value = product.tag || 'Standard';
    document.getElementById('productStatut').value = product.statut || 'Disponible';
    document.getElementById('productPrix').value = product.prix || '';
    document.getElementById('productDevise').value = product.devise || 'EUR';
    document.getElementById('productDuree').value = product.duree || 'mois';
    document.getElementById('productTypeAchat').value = product.type_achat || 'panier';
    document.getElementById('productOrder').value = product.ordre_affichage || 1;
    document.getElementById('productActive').checked = product.actif;
    
    // Show all fields for editing
    categorieContainer.style.display = 'block';
    orderContainer.style.display = 'block';
    selectedCategoryInfo.style.display = 'none';
    
    // Remove auto-generation listener if exists
    nomInput.removeEventListener('input', autoGenerateSlug);
  } else {
    // Add mode - hide category and order, auto-generate slug
    titleText.textContent = 'Ajouter Produit';
    saveBtn.textContent = 'Ajouter';
    
    document.getElementById('productId').value = '';
    document.getElementById('productTag').value = 'Standard';
    document.getElementById('productStatut').value = 'Disponible';
    document.getElementById('productDevise').value = 'EUR';
    document.getElementById('productDuree').value = 'mois';
    document.getElementById('productTypeAchat').value = 'panier';
    document.getElementById('productActive').checked = true;
    
    // Hide category and order fields, show info
    categorieContainer.style.display = 'none';
    orderContainer.style.display = 'none';
    selectedCategoryInfo.style.display = 'block';
    selectedCategoryInfo.innerHTML = `Catégorie: <strong>${AdminMain.currentCategoryName()}</strong> | Ordre d'affichage: <strong>Automatique</strong>`;
    
    // Set category value
    if (preselectedCategoryId && AdminMain.currentCategoryId()) {
      categorySelect.value = preselectedCategoryId;
    }
    
    // Auto-generate next order
    setNextOrderForCategory();
    
    // Add slug auto-generation
    nomInput.addEventListener('input', autoGenerateSlug);
  }

  // Init Quill + load description_html and images once the modal is visible
  document.getElementById('productModal').addEventListener('shown.bs.modal', function () {
    initQuillOnce();

    if (product) {
      quillEditor.clipboard.dangerouslyPasteHTML(product.description_html || '');
      productImagesList = JSON.parse(product.images || '[]');
    } else {
      quillEditor.clipboard.dangerouslyPasteHTML('');
      productImagesList = [];
    }
    renderImagesPreview();
    document.getElementById('productImages').value = JSON.stringify(productImagesList);
  }, { once: true });

  modal.show();
}

// Auto-generate slug based on category + product name
function autoGenerateSlug() {
  const nomInput = document.getElementById('productNom');
  const slugInput = document.getElementById('productSlug');
  const categoryName = AdminMain.currentCategoryName();
  
  if (nomInput.value && categoryName) {
    // Create slug: category-product-name
    const categorySlug = AdminUtils.slugify(categoryName);
    const productSlug = AdminUtils.slugify(nomInput.value);
    
    const generatedSlug = `${categorySlug}-${productSlug}`;
    slugInput.value = generatedSlug;
  }
}

// Set next order for category automatically
async function setNextOrderForCategory() {
  const currentCategoryId = AdminMain.currentCategoryId();
  if (!currentCategoryId) return;

  try {
    const response = await fetch('/admin/api/products', {
      headers: buildProductHeaders(),
      credentials: 'include'
    });
    
    if (response.ok) {
      const products = await response.json();
      const categoryProducts = products.filter(p => 
        p.id_categorie && p.id_categorie.toString() === currentCategoryId.toString()
      );
      
      // Find highest order + 1
      const maxOrder = categoryProducts.reduce((max, product) => {
        const order = product.ordre_affichage || 1;
        return order > max ? order : max;
      }, 0);
      
      document.getElementById('productOrder').value = maxOrder + 1;
    }
  } catch (error) {
    // Default to 1 if anything fails
    document.getElementById('productOrder').value = 1;
  }
}

// Save product
async function saveProduct() {
  try {
    
    const productId = document.getElementById('productId').value;

    // Get category - use current category if we're in category view and adding
    let categoryId = document.getElementById('productCategorie').value;
    if (!productId && AdminMain.currentCategoryId() && !categoryId) {
      // Adding new product from category view
      categoryId = AdminMain.currentCategoryId();
    }

    // Validate required fields
    if (!document.getElementById('productNom').value.trim()) {
      throw new Error('Le nom du produit est requis');
    }
    if (!document.getElementById('productSlug').value.trim()) {
      throw new Error('Le slug est requis');
    }
    if (!categoryId) {
      throw new Error('La catégorie est requise');
    }

    const productData = {
      nom: document.getElementById('productNom').value.trim(),
      slug: document.getElementById('productSlug').value.trim(),
      description_courte: document.getElementById('productDescCourte').value.trim(),
      description_longue: document.getElementById('productDescLongue').value.trim(),
      description_html: quillEditor ? quillEditor.root.innerHTML : '',
      images: document.getElementById('productImages').value || '[]',
      id_categorie: parseInt(categoryId),
      tag: document.getElementById('productTag').value,
      statut: document.getElementById('productStatut').value,
      prix: parseFloat(document.getElementById('productPrix').value) || null,
      devise: document.getElementById('productDevise').value,
      duree: document.getElementById('productDuree').value,
      type_achat: document.getElementById('productTypeAchat').value,
      ordre_affichage: parseInt(document.getElementById('productOrder').value) || 1,
      actif: document.getElementById('productActive').checked
    };

    const url = productId ? `/admin/api/products/${productId}` : '/admin/api/products';
    const method = productId ? 'PUT' : 'POST';

    console.log('Sending product data:', productData);

    const response = await fetch(url, {
      method: method,
      headers: {
        ...buildProductHeaders(true)
      },
      credentials: 'include',
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    // Close modal and refresh list
    const modal = bootstrap.Modal.getInstance(
      document.getElementById('productModal')
    );
    modal.hide();
    
    if (AdminMain.currentCategoryId()) {
      loadCategoryProducts();
    }

    // Show success message
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
      ${productId ? 'Produit modifié' : 'Produit créé'} avec succès!
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
      adminContent.insertBefore(alertDiv, adminContent.firstChild);
    }

  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    alert('Erreur lors de la sauvegarde du produit: ' + error.message);
  }
}

// Delete product
async function deleteProduct(productId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
    return;
  }

  try {
    const response = await fetch(`/admin/api/products/${productId}`, {
      method: 'DELETE',
      headers: buildProductHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression du produit');
    }

    if (AdminMain.currentCategoryId()) {
      loadCategoryProducts();
    }

    // Show success message
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
      Produit supprimé avec succès!
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const adminContent = document.querySelector('.admin-content');
    if (adminContent) {
      adminContent.insertBefore(alertDiv, adminContent.firstChild);
    }

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression du produit: ' + error.message);
  }
}

// Move product up or down in order
async function moveProduct(productId, direction) {
  try {
    
    await moveItemClientSide('product', productId, direction);
  } catch (error) {
    console.error(`Erreur lors du déplacement du produit:`, error);
    AdminUtils.showAlert(`Erreur lors du déplacement: ${error.message}`, 'danger');
  }
}

// Client-side implementation for moving items when API endpoints don't exist
async function moveItemClientSide(type, itemId, direction) {
  try {
    
    let apiEndpoint, idField;
    
    if (type === 'product') {
      apiEndpoint = '/admin/api/products';
      idField = 'id_produit';
    } else if (type === 'category') {
      apiEndpoint = '/admin/api/categories';
      idField = 'id_categorie';
    } else if (type === 'image') {
      apiEndpoint = '/admin/api/carousel-images';
      idField = 'id_image';
    } else {
      throw new Error(`Type ${type} non supporté`);
    }
    
    // Get all items
    const response = await fetch(apiEndpoint, {
      headers: buildProductHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des ${type}s`);
    }

    let items = await response.json();
    
    // Filter for current category if we're dealing with products
    if (type === 'product' && AdminMain.currentCategoryId()) {
      const categoryId = AdminMain.currentCategoryId();
      items = items.filter(item => 
        item.id_categorie && item.id_categorie.toString() === categoryId.toString()
      );
    }
    
    const orderField = 'ordre_affichage';
    
    // Sort items by current order, then by ID to ensure consistent ordering
    items.sort((a, b) => {
      const orderA = a[orderField] || 999;
      const orderB = b[orderField] || 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a[idField] - b[idField];
    });
    
    // Find current item index in sorted array
    const currentIndex = items.findIndex(item => item[idField] == itemId);
    
    if (currentIndex === -1) {
      throw new Error(`${type} introuvable`);
    }
    
    // Calculate new position
    let newIndex;
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(items.length - 1, currentIndex + 1);
    }
    
    // If no change needed
    if (newIndex === currentIndex) {
      AdminUtils.showAlert(`Le ${type} est déjà à ${direction === 'up' ? 'la première' : 'la dernière'} position`, 'info');
      return;
    }
    
    // Move item in array
    const itemToMove = items[currentIndex];
    items.splice(currentIndex, 1);
    items.splice(newIndex, 0, itemToMove);
    
    // Update all orders sequentially (1, 2, 3, ...)
    for (let i = 0; i < items.length; i++) {
      const newOrder = i + 1;
      if (items[i][orderField] !== newOrder) {
        await updateItemOrder(type, items[i][idField], newOrder);
      }
    }
    
    // Reload the list
    if (type === 'product') {
      loadCategoryProducts();
    } else if (type === 'category') {
      AdminCategories.loadCategories();
    } else if (type === 'image') {
      AdminImages.loadImages();
    }
    
    let successMessage;
    if (type === 'product') {
      successMessage = 'Produit déplacé avec succès!';
    } else if (type === 'category') {
      successMessage = 'Catégorie déplacée avec succès!';
    } else if (type === 'image') {
      successMessage = 'Image déplacée avec succès!';
    }
    
    AdminUtils.showAlert(successMessage, 'success');
    
  } catch (error) {
    console.error(`Erreur lors du déplacement du ${type}:`, error);
    throw error;
  }
}

// Update item order - Simplified version that works with our API
async function updateItemOrder(type, itemId, newOrder) {
  
  
  try {
    let listEndpoint, idField;
    
    if (type === 'product') {
      listEndpoint = '/admin/api/products';
      idField = 'id_produit';
    } else if (type === 'category') {
      listEndpoint = '/admin/api/categories';
      idField = 'id_categorie';
    } else if (type === 'image') {
      listEndpoint = '/admin/api/carousel-images';
      idField = 'id_image';
    } else {
      throw new Error(`Type ${type} non supporté`);
    }
    
    // Get all items to find the one we want to update
    const listResponse = await fetch(listEndpoint, {
      headers: buildProductHeaders(),
      credentials: 'include'
    });
    
    if (!listResponse.ok) {
      throw new Error(`Erreur lors de la récupération de la liste des ${type}s`);
    }
    
    const allItems = await listResponse.json();
    const currentItem = allItems.find(item => item[idField] == itemId);
    
    if (!currentItem) {
      throw new Error(`${type} avec l'ID ${itemId} introuvable`);
    }
    
    // Update the item with new order
    const updateData = {
      ...currentItem,
      ordre_affichage: newOrder
    };
    
    const updateEndpoint = `${listEndpoint}/${itemId}`;
    const updateResponse = await fetch(updateEndpoint, {
      method: 'PUT',
      headers: {
        ...buildProductHeaders(true)
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Erreur lors de la mise à jour: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`Erreur dans updateItemOrder pour ${type} ${itemId}:`, error);
    throw error;
  }
}

// Export functions
window.AdminProducts = {
  loadCategoryProducts,
  openProductModal,
  saveProduct,
  deleteProduct,
  moveProduct,
  moveItemClientSide,
  autoGenerateSlug,
  setNextOrderForCategory,
  fixDuplicateOrders,
  // Rich editor & image helpers
  addImageUrl,
  uploadImage,
  removeImage
};
