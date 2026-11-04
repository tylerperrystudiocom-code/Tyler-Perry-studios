(function() {
  'use strict';
  
  // Fallback images
  const STUDIO_ADS = [
    { title: 'Tyler Perry Studios', description: 'The historic Fort McPherson campus.', image_url: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?q=80&w=1600&auto=format&fit=crop', link_url: 'about.html' },
    { title: 'Sound Stages', description: '12 purpose-built sound stages.', image_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1600&auto=format&fit=crop', link_url: 'gallery.html' },
    { title: 'Production Backlot', description: 'Over 200 acres of greenspace.', image_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1600&auto=format&fit=crop', link_url: 'gallery.html' }
  ];
  
  // 1. HAMBURGER MENU
  window.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
    }
    
    // 2. AD CAROUSEL
    loadAdCarousel();
  });
  
  async function loadAdCarousel() {
    const container = document.getElementById('adCarousel');
    if (!container) return;
    
    let ads = STUDIO_ADS;
    try {
      const res = await fetch('/api/data/advertisements');
      if (res.ok) {
        const dbAds = await res.json();
        if (dbAds && dbAds.length > 0) ads = dbAds;
      }
    } catch (error) {
      // Use fallback if offline
    }
    
    container.innerHTML = ads.map((ad, index) => `
      <div class="ad-slide ${index === 0 ? 'active' : ''}" style="background-image: url('${ad.image_url || ''}');">
        <div class="ad-slide-content">
          <h3>${ad.title}</h3>
          <p>${ad.description || ''}</p>
          ${ad.link_url ? `<a href="${ad.link_url}" class="btn btn-gold" style="padding: 10px 20px; font-size: 0.7rem; margin-top: 10px;">DISCOVER</a>` : ''}
        </div>
      </div>
    `).join('');
    
    if (ads.length > 1) {
      startAdRotation();
    }
  }
  
  function startAdRotation() {
    const slides = document.querySelectorAll('.ad-slide');
    if (slides.length === 0) return;
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 4000);
  }
})();