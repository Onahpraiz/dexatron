/* ---------- floating bean field ---------- */
(function beanField(){
  const field = document.getElementById('beanField');
  if (!field) return;
  const glyphs = ['🫘','🟢','✦'];
  const count = window.matchMedia('(max-width: 700px)').matches ? 7 : 14;
  for (let i = 0; i < count; i++){
    const el = document.createElement('span');
    el.className = 'bean';
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = (14 + Math.random() * 16) + 'px';
    const duration = 16 + Math.random() * 14;
    el.style.animationDuration = duration + 's';
    el.style.animationDelay = (Math.random() * duration) + 's';
    field.appendChild(el);
  }
})();

/* ---------- gentle reveal on scroll (supports stagger) ---------- */
(function revealOnScroll(){
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)){
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => io.observe(el));
})();

/* ---------- hero parallax (disabled on touch / reduced motion) ---------- */
(function heroParallax(){
  const char = document.getElementById('heroCharacter');
  if (!char) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(hover: none)').matches;
  if (reduce || touch) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      char.style.transform = `translateY(${y * 0.12}px)`;
      ticking = false;
    });
  });
})();

/* ---------- subtle cursor tilt on cards ---------- */
(function tiltCards(){
  const cards = document.querySelectorAll('.tilt-card');
  if (!cards.length) return;
  if (window.matchMedia('(hover: none)').matches) return;
  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${px * 6}deg) rotateX(${py * -6}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
    });
  });
})();

/* ---------- highlight today in the weekly schedule ---------- */
(function highlightToday(){
  const todayIdx = new Date().getDay();
  document.querySelectorAll('.day-card').forEach(card => {
    if (parseInt(card.dataset.day, 10) === todayIdx) card.classList.add('today');
  });
})();

/* ---------- render published content from the store ---------- */
(function renderContent(){
  const grid = document.getElementById('contentGrid');
  if (!grid || typeof DexatronStore === 'undefined') return;

  DexatronStore.getPublished().then(items => {
    grid.innerHTML = '';
    items.forEach((item, i) => {
      const card = document.createElement('article');
      card.className = 'content-card' + (item.featured ? ' is-featured' : '');
      const mediaTag = item.media_type === 'video'
        ? `<video src="${item.media_url}" poster="${item.thumb_url || ''}" controls playsinline></video>`
        : `<img src="${item.media_url}" alt="${escapeHtml(item.title)}" loading="lazy">`;
      const dateLabel = formatContentDate(item.date);
      card.innerHTML = `
        ${mediaTag}
        <div class="content-card-body">
          <span class="content-tag">${escapeHtml(item.category || 'Update')}${dateLabel ? ` <span class="content-date">&middot; ${dateLabel}</span>` : ''}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || '')}</p>
        </div>`;
      card.addEventListener('click', () => openLightbox(item));
      grid.appendChild(card);
    });
  }).catch(err => console.error('Could not load content', err));

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();

function formatContentDate(date){
  return date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

function openLightbox(item){
  const backdrop = document.getElementById('lightboxBackdrop');
  const media = document.getElementById('lightboxMedia');
  const tag = document.getElementById('lightboxTag');
  const title = document.getElementById('lightboxTitle');
  const description = document.getElementById('lightboxDescription');
  if (!backdrop || !media || !tag || !title || !description) return;

  media.innerHTML = '';
  const mediaElement = document.createElement(item.media_type === 'video' ? 'video' : 'img');
  mediaElement.src = item.media_url;
  if (item.media_type === 'video'){
    mediaElement.controls = true;
    mediaElement.playsInline = true;
  } else {
    mediaElement.alt = item.title || '';
  }
  media.appendChild(mediaElement);
  tag.textContent = `${item.category || 'Update'}${formatContentDate(item.date) ? ` · ${formatContentDate(item.date)}` : ''}`;
  title.textContent = item.title || '';
  description.textContent = item.description || '';
  backdrop.classList.add('open');
}

(function lightboxControls(){
  const backdrop = document.getElementById('lightboxBackdrop');
  const closeButton = document.getElementById('lightboxClose');
  const media = document.getElementById('lightboxMedia');
  if (!backdrop || !closeButton || !media) return;

  function closeLightbox(){
    const video = media.querySelector('video');
    if (video) video.pause();
    media.innerHTML = '';
    backdrop.classList.remove('open');
  }

  closeButton.addEventListener('click', closeLightbox);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeLightbox();
  });
})();
