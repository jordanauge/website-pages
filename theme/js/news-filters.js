// News Advanced Filtering System
(function() {
   'use strict';
   
   // ============================================================================
   // Read Tracking with localStorage
   // ============================================================================
   
   const READ_TRACKER = {
      storageKey: 'newsReadArticles',
      lastVisitKey: 'newsLastVisit',
      
      getReadArticles() {
         try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
         } catch (e) {
            console.warn('Failed to read tracked articles:', e);
            return [];
         }
      },
      
      getLastVisit() {
         try {
            return localStorage.getItem(this.lastVisitKey) || null;
         } catch (e) {
            return null;
         }
      },
      
      markAsRead(articleId) {
         const readArticles = this.getReadArticles();
         if (!readArticles.includes(articleId)) {
            readArticles.push(articleId);
            try {
               localStorage.setItem(this.storageKey, JSON.stringify(readArticles));
            } catch (e) {
               console.warn('Failed to save read article:', e);
            }
         }
      },
      
      updateLastVisit() {
         try {
            localStorage.setItem(this.lastVisitKey, new Date().toISOString());
         } catch (e) {
            console.warn('Failed to update last visit:', e);
         }
      },
      
      isNew(articleDate, articleId) {
         const lastVisit = this.getLastVisit();
         const readArticles = this.getReadArticles();
         
         // If already read, not new
         if (readArticles.includes(articleId)) {
            return false;
         }
         
         // If no last visit, show NEW for articles from last 30 days
         if (!lastVisit) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(articleDate) > thirtyDaysAgo;
         }
         
         // Show NEW if published after last visit
         return new Date(articleDate) > new Date(lastVisit);
      }
   };
   
   // ============================================================================
   // State Management
   // ============================================================================
   
   let state = {
      viewMode: 10, // 10, 50, 100, or 'infinite'
      currentPage: 1,
      filters: {
         domains: ['research', 'personal'], // Both checked by default
         categories: [], // Empty = show all
         featured: 'all', // 'all', 'featured', 'not-featured'
         dateRange: { start: 2015, end: 2026 }
      }
   };
   
   let allNewsItems = [];
   let allCategories = new Set();
   
   // ============================================================================
   // DOM Elements
   // ============================================================================
   
   const elements = {
      newsContainer: document.getElementById('news-container'),
      loadingIndicator: document.getElementById('loading-indicator'),
      paginationControls: document.getElementById('pagination-controls'),
      prevPageBtn: document.getElementById('prev-page'),
      nextPageBtn: document.getElementById('next-page'),
      currentPageSpan: document.getElementById('current-page'),
      timelineElement: document.querySelector('.interactive-timeline'),
      timelineMarkers: document.getElementById('timeline-markers'),
      timelineLabels: document.getElementById('timeline-labels'),
      sliderThumb: document.getElementById('slider-thumb'),
      timelineSlider: document.getElementById('timeline-slider'),
      
      // Filters
      domainCheckboxes: document.querySelectorAll('input[data-type="domain"]'),
      categoryCheckboxes: document.getElementById('category-checkboxes'),
      yearRangeStart: document.getElementById('year-range-start'),
      yearRangeEnd: document.getElementById('year-range-end'),
      startYearDisplay: document.getElementById('start-year'),
      endYearDisplay: document.getElementById('end-year'),
      
      // Buttons
      resetDateBtn: document.getElementById('reset-date-filter'),
      selectAllCategoriesBtn: document.getElementById('select-all-categories'),
      clearAllCategoriesBtn: document.getElementById('clear-all-categories'),
      resetAllFiltersBtn: document.getElementById('reset-all-filters'),
      
      // Collapsible toggles
      toggleCategories: document.getElementById('toggle-categories'),
      togglePagination: document.getElementById('toggle-pagination'),
      categoriesContent: document.getElementById('categories-content'),
      paginationContent: document.getElementById('pagination-content')
   };
   
   // ============================================================================
   // Initialization
   // ============================================================================
   
   function init() {
      console.log('🚀 News filtering system initializing...');
      
      // Collect all news items
      allNewsItems = Array.from(document.querySelectorAll('.news-item'));
      console.log(`📰 Found ${allNewsItems.length} news items`);
      
      // Add NEW badges to articles
      addNewBadges();
      
      // Setup click tracking on article links
      setupReadTracking();
      
      // Extract all categories from news items
      extractCategories();
      
      // Build dynamic category checkboxes
      buildCategoryCheckboxes();
      
      // Setup event listeners
      setupDomainFilters();
      setupFeaturedFilter();
      setupDateRangeFilters();
      setupCategoryFilters();
      setupPaginationControls();
      setupCollapseToggles();
      setupResetButtons();
      
      // Build timeline
      buildTimeline();
      setupTimelineSlider();
      
      // Setup infinite scroll
      setupInfiniteScroll();
      
      // Sync domain filter state from actual checkbox state (avoids stale defaults)
      updateDomainFilters();
      updateCategoryFilters();
      
      // Initial render
      applyFiltersAndRender();
      
      console.log('✅ News filtering system ready');
   }
   
   // ============================================================================
   // Category Management
   // ============================================================================
   
   function extractCategories() {
      allNewsItems.forEach(item => {
         const tags = item.dataset.tags ? item.dataset.tags.split(',') : [];
         tags.forEach(tag => allCategories.add(tag.trim()));
      });
      
      console.log(`🏷️  Found ${allCategories.size} categories:`, Array.from(allCategories));
   }
   
   // ============================================================================
   // Read Tracking Functions
   // ============================================================================
   
   function addNewBadges() {
      allNewsItems.forEach(item => {
         const articleDate = item.dataset.date;
         const articleId = item.dataset.articleId;
         
         if (READ_TRACKER.isNew(articleDate, articleId)) {
            // Add NEW badge to the news item
            const titleElement = item.querySelector('.news-title');
            if (titleElement && !titleElement.querySelector('.new-badge')) {
               const badge = document.createElement('span');
               badge.className = 'badge bg-danger new-badge ms-2';
               badge.textContent = 'NEW';
               badge.style.fontSize = '0.7em';
               badge.style.verticalAlign = 'middle';
               titleElement.appendChild(badge);
            }
         }
      });
   }
   
   function setupReadTracking() {
      allNewsItems.forEach(item => {
         const articleLink = item.querySelector('.news-title a');
         const articleId = item.dataset.articleId;
         
         if (articleLink && articleId) {
            articleLink.addEventListener('click', () => {
               READ_TRACKER.markAsRead(articleId);
               
               // Remove NEW badge
               const badge = item.querySelector('.new-badge');
               if (badge) {
                  badge.remove();
               }
            });
         }
      });
      
      // Update last visit when leaving page
      window.addEventListener('beforeunload', () => {
         READ_TRACKER.updateLastVisit();
      });
   }
   
   // ============================================================================
   // Category Checkboxes
   // ============================================================================
   
   function buildCategoryCheckboxes() {
      if (!elements.categoryCheckboxes) return;
      
      elements.categoryCheckboxes.innerHTML = '';
      
      const sortedCategories = Array.from(allCategories).sort();
      
      sortedCategories.forEach(category => {
         const div = document.createElement('div');
         div.className = 'form-check';
         
         const checkbox = document.createElement('input');
         checkbox.className = 'form-check-input';
         checkbox.type = 'checkbox';
         checkbox.id = `cat-${category}`;
         checkbox.value = category;
         checkbox.checked = true; // All checked by default
         
         const label = document.createElement('label');
         label.className = 'form-check-label';
         label.htmlFor = `cat-${category}`;
         label.innerHTML = `<i class="bi bi-tag"></i> ${category}`;
         
         div.appendChild(checkbox);
         div.appendChild(label);
         elements.categoryCheckboxes.appendChild(div);
      });
   }
   
   // ============================================================================
   // Event Listeners Setup
   // ============================================================================
   
   function setupDomainFilters() {
      elements.domainCheckboxes.forEach(checkbox => {
         checkbox.addEventListener('change', () => {
            updateDomainFilters();
            applyFiltersAndRender();
         });
      });
   }
   
   function setupFeaturedFilter() {
      const radios = document.querySelectorAll('input[name="featured-filter"]');
      radios.forEach(radio => {
         radio.addEventListener('change', () => {
            state.filters.featured = radio.value;
            applyFiltersAndRender();
         });
      });
   }

   function setupDateRangeFilters() {
      const sliderElement = document.getElementById('year-range-slider');
      if (!sliderElement || typeof noUiSlider === 'undefined') {
         console.warn('noUiSlider not available, skipping date range filter');
         return;
      }
      
      // Compute year range from actual data
      const years = allNewsItems.map(item => parseInt(item.dataset.year));
      const minYear = years.length ? Math.min(...years) : 2015;
      const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
      
      state.filters.dateRange = { start: minYear, end: maxYear };
      
      // Initialize noUiSlider with dual handles
      noUiSlider.create(sliderElement, {
         start: [minYear, maxYear],
         connect: true,
         step: 1,
         range: {
            'min': minYear,
            'max': maxYear
         },
         tooltips: false,
         format: {
            to: value => Math.round(value),
            from: value => Math.round(value)
         }
      });
      
      // Update badges and filter on slider change
      sliderElement.noUiSlider.on('update', (values, handle) => {
         const startYear = parseInt(values[0]);
         const endYear = parseInt(values[1]);
         
         elements.startYearDisplay.textContent = startYear;
         elements.endYearDisplay.textContent = endYear;
         
         state.filters.dateRange.start = startYear;
         state.filters.dateRange.end = endYear;
      });
      
      // Apply filters on slider change (debounced)
      sliderElement.noUiSlider.on('change', () => {
         applyFiltersAndRender();
      });
   }
   
   function setupCategoryFilters() {
      if (!elements.categoryCheckboxes) return;
      
      // Delegate event to parent (since checkboxes are dynamically created)
      elements.categoryCheckboxes.addEventListener('change', (e) => {
         if (e.target.type === 'checkbox') {
            updateCategoryFilters();
            applyFiltersAndRender();
         }
      });
   }
   
   function setupPaginationControls() {
      // View mode buttons
      document.querySelectorAll('[data-mode]').forEach(btn => {
         btn.addEventListener('click', () => {
            document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchViewMode(btn.dataset.mode);
         });
      });
      
      // Pagination buttons
      if (elements.prevPageBtn) {
         elements.prevPageBtn.addEventListener('click', () => changePage(-1));
      }
      if (elements.nextPageBtn) {
         elements.nextPageBtn.addEventListener('click', () => changePage(1));
      }
   }
   
   function setupCollapseToggles() {
      // Categories collapse toggle
      if (elements.toggleCategories && elements.categoriesContent) {
         elements.toggleCategories.addEventListener('click', () => {
            const isExpanded = elements.categoriesContent.classList.contains('show');
            if (isExpanded) {
               elements.categoriesContent.classList.remove('show');
               elements.toggleCategories.setAttribute('aria-expanded', 'false');
            } else {
               elements.categoriesContent.classList.add('show');
               elements.toggleCategories.setAttribute('aria-expanded', 'true');
            }
         });
      }
      
      // Pagination collapse toggle
      if (elements.togglePagination && elements.paginationContent) {
         elements.togglePagination.addEventListener('click', () => {
            const isExpanded = elements.paginationContent.classList.contains('show');
            if (isExpanded) {
               elements.paginationContent.classList.remove('show');
               elements.togglePagination.setAttribute('aria-expanded', 'false');
            } else {
               elements.paginationContent.classList.add('show');
               elements.togglePagination.setAttribute('aria-expanded', 'true');
            }
         });
      }
   }
   
   function setupResetButtons() {
      // Reset date filter
      if (elements.resetDateBtn) {
         elements.resetDateBtn.addEventListener('click', () => {
            resetDateFilter();
            applyFiltersAndRender();
         });
      }
      
      // Select all domains
      const selectAllDomainsBtn = document.getElementById('select-all-domains');
      if (selectAllDomainsBtn) {
         selectAllDomainsBtn.addEventListener('click', () => {
            elements.domainCheckboxes.forEach(cb => cb.checked = true);
            updateDomainFilters();
            applyFiltersAndRender();
         });
      }
      
      // Clear all domains
      const clearAllDomainsBtn = document.getElementById('clear-all-domains');
      if (clearAllDomainsBtn) {
         clearAllDomainsBtn.addEventListener('click', () => {
            elements.domainCheckboxes.forEach(cb => cb.checked = false);
            updateDomainFilters();
            applyFiltersAndRender();
         });
      }
      
      // Select all categories
      if (elements.selectAllCategoriesBtn) {
         elements.selectAllCategoriesBtn.addEventListener('click', () => {
            selectAllCategories(true);
            applyFiltersAndRender();
         });
      }
      
      // Clear all categories
      if (elements.clearAllCategoriesBtn) {
         elements.clearAllCategoriesBtn.addEventListener('click', () => {
            selectAllCategories(false);
            applyFiltersAndRender();
         });
      }
      
      // Reset all filters
      if (elements.resetAllFiltersBtn) {
         elements.resetAllFiltersBtn.addEventListener('click', () => {
            resetAllFilters();
            applyFiltersAndRender();
         });
      }
   }
   
   // ============================================================================
   // Filter Updates
   // ============================================================================
   
   function updateDomainFilters() {
      state.filters.domains = [];
      elements.domainCheckboxes.forEach(checkbox => {
         if (checkbox.checked) {
            state.filters.domains.push(checkbox.dataset.filter);
         }
      });
      console.log('🔍 Domain filters:', state.filters.domains);
   }
   
   function updateCategoryFilters() {
      state.filters.categories = [];
      const checkboxes = elements.categoryCheckboxes.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
         if (checkbox.checked) {
            state.filters.categories.push(checkbox.value);
         }
      });
      console.log('🏷️  Category filters:', state.filters.categories);
   }
   
   function resetDateFilter() {
      const years = allNewsItems.map(item => parseInt(item.dataset.year));
      const minYear = years.length ? Math.min(...years) : 2015;
      const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
      
      state.filters.dateRange = { start: minYear, end: maxYear };
      
      // Reset noUiSlider if it exists
      const sliderElement = document.getElementById('year-range-slider');
      if (sliderElement && sliderElement.noUiSlider) {
         sliderElement.noUiSlider.set([minYear, maxYear]);
      }
      
      // Update display badges
      if (elements.startYearDisplay) elements.startYearDisplay.textContent = minYear;
      if (elements.endYearDisplay) elements.endYearDisplay.textContent = maxYear;
   }
   
   function selectAllCategories(select) {
      const checkboxes = elements.categoryCheckboxes.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
         checkbox.checked = select;
      });
      updateCategoryFilters();
   }
   
   function resetAllFilters() {
      // Reset domains (check all)
      elements.domainCheckboxes.forEach(checkbox => {
         checkbox.checked = true;
      });
      state.filters.domains = ['research', 'personal'];
      
      // Reset categories (check all)
      selectAllCategories(true);
      
      // Reset featured filter
      state.filters.featured = 'all';
      const featuredAll = document.getElementById('featured-all');
      if (featuredAll) featuredAll.checked = true;
      
      // Reset date range
      resetDateFilter();
      
      console.log('🔄 All filters reset');
   }
   
   // ============================================================================
   // Filtering Logic
   // ============================================================================
   
   function getFilteredItems() {
      return allNewsItems.filter(item => {
         // Domain filter
         const itemDomain = item.dataset.domain || 'personal';
         const domainMatch = state.filters.domains.includes(itemDomain);
         
         // Date filter
         const itemYear = parseInt(item.dataset.year);
         const dateMatch = itemYear >= state.filters.dateRange.start && 
                          itemYear <= state.filters.dateRange.end;
         
         // Featured filter
         let featuredMatch = true;
         if (state.filters.featured === 'featured') {
            featuredMatch = item.dataset.featured === 'true';
         } else if (state.filters.featured === 'not-featured') {
            featuredMatch = item.dataset.featured !== 'true';
         }
         
         // Category filter (empty = show all)
         let categoryMatch = true;
         if (state.filters.categories.length > 0 && state.filters.categories.length < allCategories.size) {
            const itemTags = item.dataset.tags ? item.dataset.tags.split(',').map(t => t.trim()) : [];
            categoryMatch = itemTags.some(tag => state.filters.categories.includes(tag));
         }
         
         return domainMatch && dateMatch && featuredMatch && categoryMatch;
      });
   }
   
   function applyFiltersAndRender() {
      state.currentPage = 1;
      
      if (state.viewMode === 'infinite') {
         renderInfiniteMode();
      } else {
         renderPaginatedMode();
      }
      
      updateTimelineMarkers();
   }
   
   // ============================================================================
   // Rendering
   // ============================================================================
   
   function renderPaginatedMode() {
      const filteredItems = getFilteredItems();
      const totalPages = Math.ceil(filteredItems.length / state.viewMode);
      const start = (state.currentPage - 1) * state.viewMode;
      const end = start + state.viewMode;
      
      // Show/hide items
      allNewsItems.forEach(item => {
         const filteredIndex = filteredItems.indexOf(item);
         const shouldShow = filteredIndex >= start && filteredIndex < end;
         item.style.display = shouldShow ? 'block' : 'none';
      });
      
      // Update pagination controls
      if (elements.currentPageSpan) elements.currentPageSpan.textContent = state.currentPage;
      if (elements.prevPageBtn) elements.prevPageBtn.disabled = state.currentPage === 1;
      if (elements.nextPageBtn) elements.nextPageBtn.disabled = state.currentPage >= totalPages;
      
      console.log(`📄 Page ${state.currentPage}/${totalPages} (${filteredItems.length} items)`);
   }
   
   function renderInfiniteMode() {
      const filteredItems = getFilteredItems();
      const initialLoad = 20;
      
      filteredItems.slice(0, initialLoad).forEach(item => {
         item.style.display = 'block';
      });
      
      filteredItems.slice(initialLoad).forEach(item => {
         item.style.display = 'none';
      });
      
      allNewsItems.forEach(item => {
         if (!filteredItems.includes(item)) {
            item.style.display = 'none';
         }
      });
      
      state.currentLoadedIndex = Math.min(initialLoad, filteredItems.length);
   }
   
   function switchViewMode(mode) {
      state.viewMode = mode === 'infinite' ? 'infinite' : parseInt(mode);
      state.currentPage = 1;
      
      if (state.viewMode === 'infinite') {
         elements.paginationControls.style.display = 'none';
         if (elements.timelineElement) elements.timelineElement.classList.add('visible');
         renderInfiniteMode();
         enableInfiniteScroll(true);
      } else {
         elements.paginationControls.style.display = 'block';
         if (elements.timelineElement) elements.timelineElement.classList.remove('visible');
         renderPaginatedMode();
         enableInfiniteScroll(false);
      }
   }
   
   function changePage(delta) {
      const filteredItems = getFilteredItems();
      const maxPage = Math.ceil(filteredItems.length / state.viewMode);
      state.currentPage = Math.max(1, Math.min(state.currentPage + delta, maxPage));
      renderPaginatedMode();
      window.scrollTo({ top: 0, behavior: 'smooth' });
   }
   
   // ============================================================================
   // Timeline
   // ============================================================================
   
   function buildTimeline() {
      if (!allNewsItems.length || !elements.timelineMarkers || !elements.timelineLabels) return;
      
      const dates = allNewsItems.map(item => new Date(item.dataset.date));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const timeRange = maxDate - minDate;
      
      elements.timelineMarkers.innerHTML = '';
      elements.timelineLabels.innerHTML = '';
      
      // Add markers
      allNewsItems.forEach((item, index) => {
         const date = new Date(item.dataset.date);
         const position = ((date - minDate) / timeRange) * 100;
         
         const marker = document.createElement('div');
         marker.className = 'timeline-marker';
         marker.style.top = `${100 - position}%`;
         marker.dataset.index = index;
         marker.dataset.date = item.dataset.date;
         marker.title = `${date.toLocaleDateString()} - ${item.querySelector('.news-title a')?.textContent || ''}`;
         elements.timelineMarkers.appendChild(marker);
         
         marker.addEventListener('click', () => {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
         });
      });
      
      // Add year labels
      const years = [...new Set(allNewsItems.map(item => item.dataset.year))].sort().reverse();
      years.forEach(year => {
         const yearItems = allNewsItems.filter(item => item.dataset.year === year);
         const firstDate = new Date(yearItems[yearItems.length - 1].dataset.date);
         const position = ((firstDate - minDate) / timeRange) * 100;
         
         const label = document.createElement('div');
         label.className = 'timeline-label';
         label.style.top = `${100 - position}%`;
         label.textContent = year;
         elements.timelineLabels.appendChild(label);
      });
      
      if (elements.timelineSlider) {
         elements.timelineSlider.dataset.minDate = minDate.getTime();
         elements.timelineSlider.dataset.maxDate = maxDate.getTime();
      }
   }
   
   function updateTimelineMarkers() {
      if (!elements.timelineMarkers) return;
      
      const filteredItems = getFilteredItems();
      const markers = elements.timelineMarkers.querySelectorAll('.timeline-marker');
      
      markers.forEach((marker, index) => {
         const item = allNewsItems[index];
         if (!item) return;
         
         const isFiltered = filteredItems.includes(item);
         marker.classList.toggle('filtered', !isFiltered);
         marker.classList.toggle('active', isFiltered);
      });
   }
   
   function setupTimelineSlider() {
      if (!elements.sliderThumb || !elements.timelineSlider) return;
      
      let isDragging = false;
      
      elements.sliderThumb.addEventListener('mousedown', () => {
         isDragging = true;
      });
      
      document.addEventListener('mousemove', (e) => {
         if (!isDragging) return;
         
         const rect = elements.timelineSlider.getBoundingClientRect();
         const y = e.clientY - rect.top;
         const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
         
         updateSliderPosition(percentage);
         scrollToTimelinePosition(percentage, false);
      });
      
      document.addEventListener('mouseup', () => {
         isDragging = false;
      });
      
      elements.timelineSlider.addEventListener('click', (e) => {
         if (e.target === elements.sliderThumb) return;
         
         const rect = elements.timelineSlider.getBoundingClientRect();
         const y = e.clientY - rect.top;
         const percentage = (y / rect.height) * 100;
         
         updateSliderPosition(percentage);
         scrollToTimelinePosition(percentage, true);
      });
   }
   
   function updateSliderPosition(percentage) {
      if (elements.sliderThumb) {
         elements.sliderThumb.style.top = `${percentage}%`;
      }
   }
   
   function scrollToTimelinePosition(percentage, smooth = true) {
      if (!elements.timelineSlider) return;
      
      const minDate = parseInt(elements.timelineSlider.dataset.minDate);
      const maxDate = parseInt(elements.timelineSlider.dataset.maxDate);
      const targetDate = new Date(minDate + ((100 - percentage) / 100) * (maxDate - minDate));
      
      const filteredItems = getFilteredItems();
      let closestItem = filteredItems[0];
      let minDiff = Math.abs(new Date(closestItem.dataset.date) - targetDate);
      
      filteredItems.forEach(item => {
         const diff = Math.abs(new Date(item.dataset.date) - targetDate);
         if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
         }
      });
      
      if (closestItem) {
         closestItem.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      }
   }
   
   // ============================================================================
   // Infinite Scroll
   // ============================================================================
   
   let infiniteScrollEnabled = false;
   
   function setupInfiniteScroll() {
      window.addEventListener('scroll', handleInfiniteScroll);
   }
   
   function enableInfiniteScroll(enabled) {
      infiniteScrollEnabled = enabled;
      if (enabled) {
         state.currentLoadedIndex = 20;
      }
   }
   
   function handleInfiniteScroll() {
      if (!infiniteScrollEnabled) return;
      
      const filteredItems = getFilteredItems();
      if (state.currentLoadedIndex >= filteredItems.length) return;
      
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (scrollPosition > documentHeight - 200) {
         loadMoreNews(filteredItems);
      }
   }
   
   function loadMoreNews(filteredItems) {
      if (!filteredItems) filteredItems = getFilteredItems();
      if (state.currentLoadedIndex >= filteredItems.length) return;
      
      if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'block';
      
      setTimeout(() => {
         const nextBatch = 10;
         const end = Math.min(state.currentLoadedIndex + nextBatch, filteredItems.length);
         
         for (let i = state.currentLoadedIndex; i < end; i++) {
            filteredItems[i].style.display = 'block';
         }
         
         state.currentLoadedIndex = end;
         if (elements.loadingIndicator) elements.loadingIndicator.style.display = 'none';
         
         console.log(`📜 Loaded more news: ${state.currentLoadedIndex}/${filteredItems.length}`);
      }, 300);
   }
   
   // ============================================================================
   // Auto-initialize
   // ============================================================================
   
   if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
   } else {
      init();
   }
   
})();
