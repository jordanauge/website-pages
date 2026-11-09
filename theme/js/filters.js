/**
 * Filter functionality for blog and news listings
 * Handles multi-select filtering by category, tags, and date range
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize filters on blog and news pages
  initializeBlogFilters();
  initializeNewsFilters();
});

/**
 * Initialize blog filters (categories + tags + date range)
 */
function initializeBlogFilters() {
  const blogPage = document.querySelector('.blog-index-page:not(.news-index-page)');
  if (!blogPage) return;

  const categoryCheckboxes = document.querySelectorAll('input[name="filter-category"]');
  const tagCheckboxes = document.querySelectorAll('input[name="filter-tag"]');
  const resetDateBtn = document.getElementById('reset-date-filter');
  const entries = document.querySelectorAll('.blog-post-entry');

  // Initialize noUiSlider for date range
  const dateSliderEl = document.getElementById('blog-date-slider');
  let dateSlider = null;
  if (dateSliderEl && typeof noUiSlider !== 'undefined') {
    const sliderMin = parseInt(dateSliderEl.dataset.min || '2016');
    const sliderMax = parseInt(dateSliderEl.dataset.max || new Date().getFullYear());
    noUiSlider.create(dateSliderEl, {
      start: [sliderMin, sliderMax],
      connect: true,
      step: 1,
      range: { min: sliderMin, max: sliderMax },
      format: { to: v => Math.round(v), from: Number }
    });
    dateSlider = dateSliderEl.noUiSlider;
    dateSlider.on('update', function(values) {
      document.getElementById('min-year-display').textContent = values[0];
      document.getElementById('max-year-display').textContent = values[1];
    });
  }

  if (categoryCheckboxes.length === 0 && tagCheckboxes.length === 0 && !dateSlider) return;

  // Load saved filters from localStorage
  const savedFilters = loadFiltersFromStorage('blog-filters');
  applySavedFilters(categoryCheckboxes, tagCheckboxes, savedFilters);

  // Date slider always starts at full range

  // Apply saved filter state on load
  let blogPageSize = 10;

  function doFilterBlog() {
    const selectedCategories = Array.from(categoryCheckboxes)
      .filter(cb => cb.checked).map(cb => cb.value);
    const selectedTags = Array.from(tagCheckboxes)
      .filter(cb => cb.checked).map(cb => cb.value);
    let minYear = null, maxYear = null;
    if (dateSlider) {
      const vals = dateSlider.get();
      minYear = parseInt(vals[0]);
      maxYear = parseInt(vals[1]);
    }

    // First pass: filter
    const matching = [];
    entries.forEach(entry => {
      const categorySlug = entry.dataset.categorySlug || '';
      const tags = (entry.dataset.tags || '').split(',').filter(t => t.trim());
      const year = parseInt(entry.dataset.year) || null;
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(categorySlug);
      const tagMatch = selectedTags.length === 0 || selectedTags.some(tag => tags.includes(tag));
      const dateMatch = (minYear === null || year >= minYear) && (maxYear === null || year <= maxYear);
      if (categoryMatch && tagMatch && dateMatch) matching.push(entry);
      else entry.style.display = 'none';
    });

    // Second pass: paginate
    const limit = blogPageSize === 'all' ? Infinity : parseInt(blogPageSize);
    matching.forEach((entry, i) => { entry.style.display = i < limit ? '' : 'none'; });

    // Update count display
    const showing = limit === Infinity ? matching.length : Math.min(matching.length, limit);
    const countEl = document.getElementById('blog-post-count');
    if (countEl) {
      const inner = showing < matching.length
        ? `<strong>${showing}</strong> / ${matching.length} posts`
        : `<strong>${showing}</strong> posts`;
      countEl.innerHTML = `<small>${inner}</small>`;
    }

    saveFiltersToStorage('blog-filters', categoryCheckboxes, tagCheckboxes);
  }

  // Apply saved filter state on load
  doFilterBlog();

  // Page size buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    if (btn.dataset.mode === String(blogPageSize)) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      blogPageSize = btn.dataset.mode;
      doFilterBlog();
    });
  });

  categoryCheckboxes.forEach(cb => cb.addEventListener('change', doFilterBlog));
  tagCheckboxes.forEach(cb => cb.addEventListener('change', doFilterBlog));

  if (dateSlider) {
    dateSlider.on('change', doFilterBlog);
  }

  if (resetDateBtn) {
    resetDateBtn.addEventListener('click', function() {
      if (dateSlider) {
        const sliderMin = parseInt(dateSliderEl.dataset.min || '2016');
        const sliderMax = parseInt(dateSliderEl.dataset.max || new Date().getFullYear());
        dateSlider.set([sliderMin, sliderMax]);
      }
      doFilterBlog();
    });
  }
}

/**
 * Initialize news filters (domain + tags + date range + featured)
 */
function initializeNewsFilters() {
  const newsPage = document.querySelector('.news-index-page');
  if (!newsPage) return;

  const domainCheckboxes = document.querySelectorAll('input[name="filter-domain"], .filter-domain');
  const tagCheckboxes = document.querySelectorAll('.news-index-page input[name="filter-tag"], .filter-tag');
  const featuredCheckbox = document.getElementById('featured-only');
  const newsEntries = document.querySelectorAll('.news-post-entry');

  // Initialize noUiSlider for date range
  const dateSliderEl = document.getElementById('news-date-slider');
  let dateSlider = null;
  if (dateSliderEl && typeof noUiSlider !== 'undefined') {
    const sliderMin = parseInt(dateSliderEl.dataset.min || '2019');
    const sliderMax = parseInt(dateSliderEl.dataset.max || new Date().getFullYear());
    noUiSlider.create(dateSliderEl, {
      start: [sliderMin, sliderMax],
      connect: true,
      step: 1,
      range: { min: sliderMin, max: sliderMax },
      format: { to: v => Math.round(v), from: Number }
    });
    dateSlider = dateSliderEl.noUiSlider;
    dateSlider.on('update', function(values) {
      document.getElementById('news-min-year-display').textContent = values[0];
      document.getElementById('news-max-year-display').textContent = values[1];
    });
  }

  if (domainCheckboxes.length === 0 && tagCheckboxes.length === 0 && !dateSlider) return;

  // Load saved filters
  const savedFilters = loadFiltersFromStorage('news-filters');
  applySavedNewsFilters(domainCheckboxes, tagCheckboxes, savedFilters);

  // Date slider always starts at full range

  let newsPageSize = 10;

  function doFilterNews() {
    const selectedDomains = Array.from(domainCheckboxes)
      .filter(cb => cb.checked).map(cb => cb.value).filter(val => val !== 'all');
    const selectedTags = Array.from(tagCheckboxes)
      .filter(cb => cb.checked).map(cb => cb.value);
    let minYear = null, maxYear = null;
    if (dateSlider) {
      const vals = dateSlider.get();
      minYear = parseInt(vals[0]);
      maxYear = parseInt(vals[1]);
    }
    const featuredOnly = featuredCheckbox ? featuredCheckbox.checked : false;

    // First pass: filter
    const matching = [];
    newsEntries.forEach(entry => {
      const itemDomain = entry.dataset.domain || 'personal';
      const effectiveDomain = itemDomain === 'work' ? 'research' : itemDomain;
      const itemTags = (entry.dataset.tags || '').split(',').filter(t => t.trim());
      const year = parseInt(entry.dataset.year) || null;
      const isFeatured = entry.dataset.featured === 'true';
      const domainMatch = selectedDomains.length === 0 || selectedDomains.includes(effectiveDomain);
      const tagMatch = selectedTags.length === 0 || selectedTags.some(tag => itemTags.includes(tag));
      const dateMatch = (minYear === null || year >= minYear) && (maxYear === null || year <= maxYear);
      const featuredMatch = !featuredOnly || isFeatured;
      if (domainMatch && tagMatch && dateMatch && featuredMatch) matching.push(entry);
      else entry.style.display = 'none';
    });

    // Second pass: paginate
    const limit = newsPageSize === 'all' ? Infinity : parseInt(newsPageSize);
    matching.forEach((entry, i) => { entry.style.display = i < limit ? '' : 'none'; });

    // Update count display
    const showing = limit === Infinity ? matching.length : Math.min(matching.length, limit);
    const countEl = document.getElementById('news-post-count');
    if (countEl) {
      const inner = showing < matching.length
        ? `<strong>${showing}</strong> / ${matching.length} posts`
        : `<strong>${showing}</strong> posts`;
      countEl.innerHTML = `<small>${inner}</small>`;
    }

    saveNewsFiltersToStorage('news-filters', domainCheckboxes, tagCheckboxes, featuredCheckbox);
  }

  // Apply saved filter state on load
  doFilterNews();

  // Page size buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    if (btn.dataset.mode === String(newsPageSize)) btn.classList.add('active');
    else btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      newsPageSize = btn.dataset.mode;
      doFilterNews();
    });
  });

  // Add event listeners
  domainCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', doFilterNews);
  });

  tagCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', doFilterNews);
  });

  if (dateSlider) {
    dateSlider.on('change', doFilterNews);
  }

  if (featuredCheckbox) {
    featuredCheckbox.addEventListener('change', doFilterNews);
  }
}

/**
 * Save filter state to localStorage
 */
function saveFiltersToStorage(key, categoryCheckboxes, tagCheckboxes) {
  const filters = {
    categories: categoryCheckboxes ? 
      Array.from(categoryCheckboxes).filter(cb => cb.checked).map(cb => cb.value) : [],
    tags: Array.from(tagCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value)
  };
  localStorage.setItem(key, JSON.stringify(filters));
}

/**
 * Save news filters to localStorage
 */
function saveNewsFiltersToStorage(key, domainCheckboxes, tagCheckboxes, featuredCheckbox) {
  const filters = {
    domains: Array.from(domainCheckboxes).filter(cb => cb.checked).map(cb => cb.value),
    tags: Array.from(tagCheckboxes).filter(cb => cb.checked).map(cb => cb.value),
    featured: featuredCheckbox ? featuredCheckbox.checked : false
  };
  localStorage.setItem(key, JSON.stringify(filters));
}

/**
 * Load filter state from localStorage
 */
function loadFiltersFromStorage(key) {
  const stored = localStorage.getItem(key);
  if (!stored) return { categories: [], tags: [], minYear: null, maxYear: null, domains: [], featured: false };
  try {
    return JSON.parse(stored);
  } catch (e) {
    return { categories: [], tags: [], minYear: null, maxYear: null, domains: [], featured: false };
  }
}

/**
 * Apply saved filters to checkboxes
 */
function applySavedFilters(categoryCheckboxes, tagCheckboxes, savedFilters) {
  if (categoryCheckboxes) {
    categoryCheckboxes.forEach(cb => {
      cb.checked = savedFilters.categories.includes(cb.value);
    });
  }

  tagCheckboxes.forEach(cb => {
    cb.checked = savedFilters.tags.includes(cb.value);
  });
}

/**
 * Apply saved news filters
 */
function applySavedNewsFilters(domainCheckboxes, tagCheckboxes, savedFilters) {
  domainCheckboxes.forEach(cb => {
    cb.checked = savedFilters.domains && savedFilters.domains.includes(cb.value);
  });

  tagCheckboxes.forEach(cb => {
    cb.checked = savedFilters.tags && savedFilters.tags.includes(cb.value);
  });
}
