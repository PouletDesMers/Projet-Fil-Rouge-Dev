/**
 * Images Module
 * Handles carousel images and image management in admin panel
 */

// Fix duplicate orders in images
async function fixDuplicateImageOrders(images) {
  
  
  // Sort images by their current order first, then by ID as fallback
  images.sort((a, b) => {
    const orderA = a.ordre_affichage || 999;
    const orderB = b.ordre_affichage || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If same order, sort by ID (older images first)
    return a.id_image - b.id_image;
  });
  
  // Reassign clean sequential orders: 1, 2, 3, ...
  let needsUpdate = false;
  const updatePromises = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const expectedOrder = i + 1;
    
    if (image.ordre_affichage !== expectedOrder) {
      needsUpdate = true;
      
      const updateData = {
        ...image,
        ordre_affichage: expectedOrder
      };
      
      updatePromises.push(
        fetch(`/admin/api/carousel-images/${image.id_image}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(updateData)
        }).then(response => {
          if (response.ok) {
            // Update local data
            image.ordre_affichage = expectedOrder;
          } else {
            console.warn(`Erreur lors de la mise à jour de l'ordre de l'image ${image.id_image}`);
          }
        }).catch(error => {
          console.warn(`Erreur lors de la correction de l'ordre de l'image ${image.id_image}:`, error);
        })
      );
    }
  }
  
  // Wait for all updates to complete
  if (needsUpdate && updatePromises.length > 0) {
    try {
      await Promise.all(updatePromises);
      console.log(`Ordres d'affichage recalculés pour ${updatePromises.length} images (séquence 1-2-3...)`);
    } catch (error) {
      console.warn('Erreur lors de la correction des ordres:', error);
    }
  }
}

// Load images
async function loadImages() {
  try {


    const token = localStorage.getItem('token');
    const response = await fetch('/admin/api/carousel-images', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des images');
    }

    const images = await response.json();
    
    // Fix duplicate orders before rendering
    await fixDuplicateImageOrders(images);
    
    renderImages(images);
  } catch (error) {
    console.error('Erreur lors du chargement des images:', error);
    document.getElementById('imagesContainer').innerHTML =
      '<div class="alert alert-danger">Erreur lors du chargement des images: ' +
      error.message +
      '</div>';
  }
}

// Render images
function renderImages(images) {
  const container = document.getElementById('imagesContainer');

  if (!images || images.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">
        <i class="bi bi-info-circle"></i> Aucune image trouvée.
        <br>
        <button class="btn btn-primary btn-sm mt-2" onclick="AdminImages.openImageModal()">
          <i class="bi bi-plus-circle"></i> Ajouter une image
        </button>
      </div>
    `;
    return;
  }

  // Sort by order
  images.sort((a, b) => (a.ordre_affichage || 999) - (b.ordre_affichage || 999));

  const tableHTML = `
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Ordre</th>
            <th>Aperçu</th>
            <th>Titre</th>
            <th>URL</th>
            <th>Alt Text</th>
            <th>Actif</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${images
            .map(
              (image, index) => `
            <tr>
              <td><span class="badge bg-secondary">${image.ordre_affichage || 1}</span></td>
              <td>
                <img src="${image.url_image}" alt="${image.alt_text}" style="width: 60px; height: 40px; object-fit: cover;" class="rounded">
              </td>
              <td>
                <strong>${image.titre}</strong>
              </td>
              <td>
                <small class="text-muted">${image.url_image}</small>
              </td>
              <td>
                <small>${image.alt_text || 'Non défini'}</small>
              </td>
              <td>
                <span class="badge ${image.actif ? 'bg-success' : 'bg-danger'}">${
                image.actif ? 'Actif' : 'Inactif'
              }</span>
              </td>
              <td>
                <div class="btn-group" role="group">
                  ${index > 0 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminImages.moveImage(${image.id_image}, 'up')" title="Déplacer vers le haut">
                    <i class="bi bi-arrow-up"></i>
                  </button>` : ''}
                  ${index < images.length - 1 ? `<button class="btn btn-sm btn-outline-secondary" onclick="AdminImages.moveImage(${image.id_image}, 'down')" title="Déplacer vers le bas">
                    <i class="bi bi-arrow-down"></i>
                  </button>` : ''}
                </div>
                <button class="btn btn-sm btn-outline-primary me-1 ms-2" onclick="AdminImages.openImageModal(${JSON.stringify(image).replace(/"/g, '&quot;')})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="AdminImages.deleteImage(${image.id_image})">
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
}

// Open image modal
function openImageModal(image = null) {
  const modal = new bootstrap.Modal(document.getElementById('imageModal'));
  const titleText = document.getElementById('imageModalTitleText');
  const saveBtn = document.getElementById('saveImageBtnText');
  const form = document.getElementById('imageForm');

  form.reset();

  if (image) {
    titleText.textContent = 'Modifier Image';
    saveBtn.textContent = 'Modifier';

    document.getElementById('imageId').value = image.id_image;
    document.getElementById('imageTitre').value = image.titre;
    document.getElementById('imageUrl').value = image.url_image;
    document.getElementById('imageAlt').value = image.alt_text || '';
    document.getElementById('imageOrder').value = image.ordre_affichage || 1;
    document.getElementById('imageActive').checked = image.actif;

    // Show preview
    updateImagePreview(image.url_image);
  } else {
    titleText.textContent = 'Ajouter Image';
    saveBtn.textContent = 'Ajouter';

    document.getElementById('imageId').value = '';
    document.getElementById('imageOrder').value = getNextImageOrder();
    document.getElementById('imageActive').checked = true;

    // Clear preview
    updateImagePreview('');
  }

  modal.show();
}

// Update image preview
function updateImagePreview(url) {
  const preview = document.getElementById('imagePreview');
  const container = document.getElementById('imagePreviewContainer');
  
  if (url && url.trim()) {
    preview.src = url;
    preview.style.display = 'block';
    container.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    container.style.display = 'none';
  }
}

// Get next order for new image
function getNextImageOrder() {
  const tableRows = document.querySelectorAll('#imagesContainer table tbody tr');
  let maxOrder = 0;

  tableRows.forEach(row => {
    const orderBadge = row.querySelector('.badge');
    if (orderBadge) {
      const order = parseInt(orderBadge.textContent);
      if (order > maxOrder) {
        maxOrder = order;
      }
    }
  });

  return maxOrder + 1;
}

// Save image
async function saveImage() {
  try {
    
    const imageId = document.getElementById('imageId').value;

    // Validate required fields
    if (!document.getElementById('imageTitre').value.trim()) {
      throw new Error('Le titre de l\'image est requis');
    }
    if (!document.getElementById('imageUrl').value.trim()) {
      throw new Error('L\'URL de l\'image est requise');
    }

    const imageData = {
      titre: document.getElementById('imageTitre').value.trim(),
      url_image: document.getElementById('imageUrl').value.trim(),
      alt_text: document.getElementById('imageAlt').value.trim() || null,
      ordre_affichage: parseInt(document.getElementById('imageOrder').value) || 1,
      actif: document.getElementById('imageActive').checked
    };

    const url = imageId ? `/admin/api/carousel-images/${imageId}` : '/admin/api/carousel-images';
    const method = imageId ? 'PUT' : 'POST';

    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(imageData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    // Close modal and refresh list
    const modal = bootstrap.Modal.getInstance(
      document.getElementById('imageModal')
    );
    modal.hide();
    loadImages();

    AdminUtils.showToast(
      `Image ${imageId ? 'modifiée' : 'ajoutée'} avec succès!`,
      'success'
    );

  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    AdminUtils.showAlert('Erreur lors de la sauvegarde: ' + error.message, 'danger');
  }
}

// Delete image
async function deleteImage(imageId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
    return;
  }

  try {


    const token = localStorage.getItem('token');
    const response = await fetch(`/admin/api/carousel-images/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression de l\'image');
    }

    loadImages();
    AdminUtils.showToast('Image supprimée avec succès!', 'success');

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    AdminUtils.showAlert('Erreur lors de la suppression: ' + error.message, 'danger');
  }
}

// Move image up or down in order
async function moveImage(imageId, direction) {
  try {
    await AdminProducts.moveItemClientSide('image', imageId, direction);
  } catch (error) {
    console.error(`Erreur lors du déplacement de l'image:`, error);
    AdminUtils.showAlert(`Erreur lors du déplacement: ${error.message}`, 'danger');
  }
}

// Initialize images section
function initImages() {
  loadImages();
}

// Set up image URL preview listener
function setupImagePreview() {
  const urlInput = document.getElementById('imageUrl');
  if (urlInput) {
    urlInput.addEventListener('input', function() {
      updateImagePreview(this.value);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setupImagePreview();
});

// Export functions
window.AdminImages = {
  loadImages,
  openImageModal,
  saveImage,
  deleteImage,
  moveImage,
  initImages,
  updateImagePreview,
  setupImagePreview,
  fixDuplicateImageOrders
};