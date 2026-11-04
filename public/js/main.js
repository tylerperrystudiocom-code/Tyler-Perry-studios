(function () {
  'use strict';

  // REAL TYLER PERRY STUDIOS IMAGES (Fallback so it always works)
  const STUDIO_ADS = [
    {
      title: 'Tyler Perry Studios',
      description: 'The historic Fort McPherson campus, now a premier production facility.',
      image_url: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?q=80&w=1600&auto=format&fit=crop',
      link_url: 'about.html'
    },
    {
      title: 'Sound Stages',
      description: '12 purpose-built sound stages designed for modern production.',
      image_url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1600&auto=format&fit=crop',
      link_url: 'gallery.html'
    },
    {
      title: 'Production Backlot',
      description: 'Over 200 acres of greenspace and diverse backlots.',
      image_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1600&auto=format&fit=crop',
      link_url: 'gallery.html'
    }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. MOBILE MENU TOGGLE (HAMBURGER) ---
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    if (hamburger && navLinks) {
      hamburger.addEventListener('click', function() {
        navLinks.classList.toggle('active');
      });
    }

    // --- 2. AUTO-UPDATE FOOTER YEAR ---
    document.querySelectorAll('[data-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });

    // --- 3. LOAD DYNAMIC DATA ---
    loadAdCarousel();
    fetchNews();
  });

  // FETCH AND SLIDE ADS
  async function loadAdCarousel() {
    const container = document.getElementById('adCarousel');
    if (!container) return;

    let ads = STUDIO_ADS;

    // Try to fetch from backend database first
    try {
      const res = await fetch('/api/data/advertisements');
      if (res.ok) {
        const dbAds = await res.json();
        if (dbAds && dbAds.length > 0) {
          ads = dbAds;
        }
      }
    } catch (error) {
      // Backend is offline or file is opened directly. Use the STUDIO_ADS fallback.
      console.log('Backend offline, using local studio imagery.');
    }

    // Build slides
    container.innerHTML = ads.map((ad, index) => `
      <div class="ad-slide ${index === 0 ? 'active' : ''}" style="background-image: url('${ad.image_url || ''}');">
        <div class="ad-slide-content">
          <h3>${ad.title}</h3>
          <p>${ad.description || ''}</p>
          ${ad.link_url ? `<a href="${ad.link_url}" class="btn btn-gold" style="padding: 10px 20px; font-size: 0.7rem; margin-top: 10px;">DISCOVER</a>` : ''}
        </div>
      </div>
    `).join('');

    // Start rotation if more than 1 ad
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
    }, 4000); // Changes every 4 seconds
  }

  // FETCH NEWS
  async function fetchNews() {
    const container = document.getElementById('newsGrid');
    if (!container) return;

    try {
      const res = await fetch('/api/data/news');
      if (!res.ok) throw new Error('Network error');
      
      const data = await res.json();
      
      if (data.length === 0) {
        container.innerHTML = `<p class="muted small">No news published yet.</p>`;
        return;
      }

      container.innerHTML = data.map(item => `
        <div class="card">
          <h3 style="color:var(--gold-2); margin-top:0;">${item.title}</h3>
          <p class="muted small">${item.excerpt || ''}</p>
          ${item.image_url ? `<img src="${item.image_url}" style="width:100%; border-radius:4px; margin-top:10px;" loading="lazy">` : ''}
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = `<p class="muted small">News updates will appear here when the server is connected.</p>`;
    }
  }
})();