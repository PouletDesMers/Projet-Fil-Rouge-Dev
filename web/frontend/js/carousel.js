// Load carousel images dynamically
async function loadCarouselImages() {
  try {
    const response = await fetch('/api/public/carousel-images');
    
    if (!response.ok) {
      throw new Error('Erreur lors du chargement des images');
    }

    const images = await response.json();
    
    if (!images || images.length === 0) {
      // Fallback to default images if no images in database
      loadDefaultCarousel();
      return;
    }

    renderCarousel(images);
  } catch (error) {
    console.error('Error loading carousel images:', error);
    // Fallback to default images on error
    loadDefaultCarousel();
  }
}

// Render carousel with dynamic images
function renderCarousel(images) {
  const indicatorsContainer = document.getElementById('carouselIndicators');
  const innerContainer = document.getElementById('carouselInner');
  
  if (!indicatorsContainer || !innerContainer) return;

  // Generate indicators
  const indicators = images.map((image, index) => `
    <button
      type="button"
      data-bs-target="#carouselExampleIndicators"
      data-bs-slide-to="${index}"
      ${index === 0 ? 'class="active" aria-current="true"' : ''}
      aria-label="${image.titre}"
    ></button>
  `).join('');

  // Generate slides
  const slides = images.map((image, index) => `
    <div class="carousel-item ${index === 0 ? 'active' : ''}">
      <img
        src="${image.url_image}"
        class="d-block w-100"
        alt="${image.alt_text || image.titre}"
        style="height: 360px; object-fit: cover;"
      />
      ${image.description ? `
        <div class="carousel-caption d-none d-md-block">
          <h5>${image.titre}</h5>
          <p>${image.description}</p>
        </div>
      ` : ''}
    </div>
  `).join('');

  indicatorsContainer.innerHTML = indicators;
  innerContainer.innerHTML = slides;
}

// Fallback to default carousel
function loadDefaultCarousel() {
  const indicatorsContainer = document.getElementById('carouselIndicators');
  const innerContainer = document.getElementById('carouselInner');
  
  if (!indicatorsContainer || !innerContainer) return;

  // Default indicators
  indicatorsContainer.innerHTML = `
    <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="0" class="active" aria-current="true" aria-label="Slide 1"></button>
    <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="1" aria-label="Slide 2"></button>
    <button type="button" data-bs-target="#carouselExampleIndicators" data-bs-slide-to="2" aria-label="Slide 3"></button>
  `;

  // Default slides
  innerContainer.innerHTML = `
    <div class="carousel-item active">
      <img src="https://placehold.co/1200x360/351E90/FFFFFF?text=Advanced+Endpoint+Protection" class="d-block w-100" alt="Advanced Endpoint Protection" />
    </div>
    <div class="carousel-item">
      <img src="https://placehold.co/1200x360/5610C0/FFFFFF?text=Global+SOC+Monitoring" class="d-block w-100" alt="Global SOC Monitoring" />
    </div>
    <div class="carousel-item">
      <img src="https://placehold.co/1200x360/7602F9/FFFFFF?text=24/7+Security+Assistance" class="d-block w-100" alt="24/7 Security Assistance" />
    </div>
  `;
}

// Load carousel on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCarouselImages();
});

// Reload carousel when returning from other pages
window.addEventListener('focus', () => {
  if (document.visibilityState === 'visible') {
    loadCarouselImages();
  }
});