// Publications Advanced Filtering System
(function() {
   'use strict';
   
   // ============================================================================
   // Constants
   // ============================================================================
   
   // Persist filters, but with schema-aware restore to keep UI and visible results coherent.
   const STORAGE_KEY = 'pub-filters-v5';
   const LEGACY_STORAGE_KEYS = ['pub-filters-v2', 'pub-filters-v3', 'pub-filters-v4'];
   
   // Default types that are checked when no saved state exists
   const DEFAULT_CHECKED_TYPES = ['preprint', 'conference', 'journal', 'workshop', 'poster', 'report', 'talk', 'ietf', 'other'];
   // Categories expanded by default (those with venue sub-checkboxes)
   const DEFAULT_EXPANDED = ['conference', 'journal'];
   
   // ============================================================================
   // State Management
   // ============================================================================
   
   let state = {
      filters: {
         types: DEFAULT_CHECKED_TYPES.slice(), // patent + deliverable excluded by default
         venues: [], // All venues checked by default — populated at init
         activities: [], // All activities checked by default — populated at init
         coauthors: [], // All coauthor slugs — populated at init
         affiliations: [], // Self-affiliation institution IDs — populated at init
         collaborations: [], // Coauthor institution IDs — populated at init
         dateRange: { start: 2010, end: new Date().getFullYear() },
         awardOnly: false,
         hasCodeOnly: false,
         hasDatasetOnly: false,
         reproducibleOnly: false
      },
      collapsed: {} // { 'venues-conference': false, 'venues-workshop': true, ... }
   };
   
   let allPublications = [];
   let totalCitations = 0;
   let hIndex = 0;
   let yearBounds = { min: 2005, max: new Date().getFullYear() };
   let authorMetadata = null; // loaded from JSON script block
   
   // ============================================================================
   // DOM Elements
   // ============================================================================
   
   const elements = {
      // Publication items
      publicationItems: null,
      
      // Type filters — tree
      pubtypeTree: document.getElementById('pubtype-tree'),
      typeCheckboxes: document.querySelectorAll('input[data-type="pubtype"]'),
      
      // Activity filters — hierarchical
      activityMasterCheckbox: document.getElementById('activity-master'),
      activityTree: document.getElementById('activity-tree'),
      activityFilterSection: document.getElementById('activity-filter-section'),
      
      // Coauthor filters
      coauthorMasterCheckbox: document.getElementById('coauthor-master'),
      coauthorTree: document.getElementById('coauthor-tree'),
      coauthorFilterSection: document.getElementById('coauthor-filter-section'),

      // Affiliation filters
      affiliationMasterCheckbox: document.getElementById('affiliation-master'),
      affiliationTree: document.getElementById('affiliation-tree'),
      affiliationFilterSection: document.getElementById('affiliation-filter-section'),

      // Collaboration filters
      collaborationMasterCheckbox: document.getElementById('collaboration-master'),
      collaborationTree: document.getElementById('collaboration-tree'),
      collaborationFilterSection: document.getElementById('collaboration-filter-section'),

      // Date range
      yearRangeSlider: document.getElementById('pub-year-range-slider'),
      startYearDisplay: document.getElementById('pub-start-year'),
      endYearDisplay: document.getElementById('pub-end-year'),
      resetDateBtn: document.getElementById('reset-pub-date-filter'),
      
      // Highlight filters
      awardFilterCheckbox: document.getElementById('filter-award'),
      hasCodeFilterCheckbox: document.getElementById('filter-has-code'),
      hasDatasetFilterCheckbox: document.getElementById('filter-has-dataset'),
      reproducibleFilterCheckbox: document.getElementById('filter-reproducible'),
      
      // Reset all
      resetAllFiltersBtn: document.getElementById('reset-all-pub-filters'),
      
      // Stats
      totalPubsDisplay: document.getElementById('total-pubs'),
      totalCitesDisplay: document.getElementById('total-cites'),
      hIndexDisplay: document.getElementById('h-index')
   };
   
   // ============================================================================
   // Initialization
   // ============================================================================
   
   function init() {
      console.log('🚀 Publications filtering system initializing...');

      clearLegacySavedState();
      
      // Load author metadata from JSON script block
      loadAuthorMetadata();
      
      // Collect all publication items
      allPublications = Array.from(document.querySelectorAll('.publication-item, .publications-list > li[data-publication-type]'));
      console.log(`📚 Found ${allPublications.length} publications`);

      yearBounds = getYearBounds();
      state.filters.dateRange = { start: yearBounds.min, end: yearBounds.max };
      
      // Calculate initial stats
      calculateStats();
      
      // Build venue sub-checkboxes inside the type tree
      buildVenueSubCheckboxes();
      
      // Build research activity filter checkboxes from data
      buildActivityCheckboxes();
      
      // Build coauthor, affiliation, and collaboration filter checkboxes
      buildCoauthorCheckboxes();
      buildAffiliationCheckboxes();
      buildCollaborationCheckboxes();
      
      // Restore saved filters after dynamic checkboxes are built.
      restoreState();
      
      // Setup event listeners
      setupTypeFilters();
      setupBadgeClickSolo();
      setupSidebarBadgeSolo();
      setupHighlightFilters();
      setupActivityFilters();
      setupCoauthorFilters();
      setupAffiliationFilters();
      setupCollaborationFilters();
      setupDateRangeFilters();
      setupResetButtons();
      setupCollapsibles();
      setupAuthorPopovers();
      
      // Add count badges to type labels in sidebar
      updateTypeCounts();
      
      // Sync master checkbox state (some types may be unchecked by default)
      syncActivityMasterCheckbox();
      syncCoauthorMasterCheckbox();
      syncAffiliationMasterCheckbox();
      syncCollaborationMasterCheckbox();
      
      // Initial render
      applyFiltersAndRender();
      
      console.log('✅ Publications filtering system ready');
   }
   
   // ============================================================================
   // Filter Setup
   // ============================================================================
   
   function setupTypeFilters() {
      // Type checkboxes — also toggle their child venue checkboxes
      elements.typeCheckboxes.forEach(checkbox => {
         checkbox.addEventListener('change', () => {
            const parentType = checkbox.value;
            const venueContainer = document.querySelector('.pubtype-venues[data-parent-type="' + parentType + '"]');
            if (venueContainer) {
               venueContainer.querySelectorAll('input[data-type="venue"]').forEach(cb => {
                  cb.checked = checkbox.checked;
               });
            }
            updateTypeFilters();
            updateVenueFilters();
            applyFiltersAndRender();
         });
      });

      // Venue sub-checkboxes — delegated on tree
      if (elements.pubtypeTree) {
         elements.pubtypeTree.addEventListener('change', (e) => {
            if (e.target.matches('input[data-type="venue"]')) {
               const parentType = e.target.closest('.pubtype-venues')?.dataset.parentType;
               if (parentType) {
                  syncParentTypeCheckbox(parentType);
               }
               updateVenueFilters();
               applyFiltersAndRender();
            }
         });
      }
   }

   function setAllTypeAndVenueCheckboxes(checked) {
      elements.typeCheckboxes.forEach(cb => {
         cb.checked = checked;
         cb.indeterminate = false;
      });
      if (elements.pubtypeTree) {
         elements.pubtypeTree.querySelectorAll('input[data-type="venue"]').forEach(cb => {
            cb.checked = checked;
         });
      }
   }

   function syncParentTypeCheckbox(parentType) {
      const typeCheckbox = document.getElementById('type-' + parentType);
      const venueContainer = document.querySelector('.pubtype-venues[data-parent-type="' + parentType + '"]');
      if (!typeCheckbox || !venueContainer) return;

      const venueCbs = venueContainer.querySelectorAll('input[data-type="venue"]');
      if (venueCbs.length === 0) return;

      const checkedCount = Array.from(venueCbs).filter(cb => cb.checked).length;
      if (checkedCount === 0) {
         typeCheckbox.checked = false;
         typeCheckbox.indeterminate = false;
      } else if (checkedCount === venueCbs.length) {
         typeCheckbox.checked = true;
         typeCheckbox.indeterminate = false;
      } else {
         typeCheckbox.checked = false;
         typeCheckbox.indeterminate = true;
      }
   }



   // Badge click-to-solo — clicking the type badge on a publication item
   // selects only that type (works like the old solo buttons but on each item)
   function setupBadgeClickSolo() {
      document.addEventListener('click', (e) => {
         const badge = e.target.closest('.publication-card-type .label, .publications-list > li .label');
         if (!badge) return;
         e.preventDefault();

         // Determine the publication type from the parent item
         const item = badge.closest('.publication-item, li[data-publication-type]');
         if (!item) return;
         const soloType = getPublicationType(item);
         if (!soloType) return;

         // Uncheck all types + venues
         setAllTypeAndVenueCheckboxes(false);
         // Check only the target type
         const targetCb = document.getElementById('type-' + soloType);
         if (targetCb) {
            targetCb.checked = true;
            targetCb.indeterminate = false;
            // Also check child venues if any
            const venueContainer = document.querySelector('.pubtype-venues[data-parent-type="' + soloType + '"]');
            if (venueContainer) {
               venueContainer.querySelectorAll('input[data-type="venue"]').forEach(cb => cb.checked = true);
            }
         }
         updateTypeFilters();
         updateVenueFilters();
         applyFiltersAndRender();
      });
   }

   // Sidebar badge click-to-solo — clicking a count badge in the sidebar filter
   // checkboxes solos that item instead of toggling its checkbox.
   function setupSidebarBadgeSolo() {
      const sidebar = document.querySelector('.publications-sidebar');
      if (!sidebar) return;

      sidebar.addEventListener('click', (e) => {
         const badge = e.target.closest('.badge');
         if (!badge) return;

         // Find the parent form-check and its checkbox
         const formCheck = badge.closest('.form-check');
         if (!formCheck) return;
         const cb = formCheck.querySelector('input[type="checkbox"]');
         if (!cb) return;

         // Prevent the label from toggling the checkbox
         e.preventDefault();
         e.stopPropagation();

         const dataType = cb.getAttribute('data-type');

         if (dataType === 'pubtype') {
            // Solo this publication type: uncheck all types + venues, check only this one
            setAllTypeAndVenueCheckboxes(false);
            cb.checked = true;
            cb.indeterminate = false;
            // Also check child venues if any
            const venueContainer = document.querySelector('.pubtype-venues[data-parent-type="' + cb.value + '"]');
            if (venueContainer) {
               venueContainer.querySelectorAll('input[data-type="venue"]').forEach(v => v.checked = true);
            }
            updateTypeFilters();
            updateVenueFilters();

         } else if (dataType === 'venue') {
            // Solo this venue: uncheck all venues under the same parent, check only this one
            const parentContainer = cb.closest('.pubtype-venues');
            if (parentContainer) {
               parentContainer.querySelectorAll('input[data-type="venue"]').forEach(v => v.checked = false);
               cb.checked = true;
               // Ensure the parent type is checked
               const parentType = parentContainer.getAttribute('data-parent-type');
               const parentCb = document.getElementById('type-' + parentType);
               if (parentCb) {
                  parentCb.checked = true;
                  parentCb.indeterminate = false;
               }
            }
            updateTypeFilters();
            updateVenueFilters();

         } else if (dataType === 'actsuper') {
            // Solo this super-group: uncheck everything, check only this super-group and all its children
            setAllActivityCheckboxes(false);
            cb.checked = true;
            const groupsContainer = elements.activityTree.querySelector('.activity-groups[data-super="' + cb.dataset.super + '"]');
            if (groupsContainer) {
               groupsContainer.querySelectorAll('input[data-type="actgroup"], input[data-type="activity"]').forEach(a => {
                  a.checked = true;
                  a.indeterminate = false;
               });
            }
            updateActivityFilters();
            syncActivityMasterCheckbox();

         } else if (dataType === 'actgroup') {
            // Solo this group: uncheck everything, check only this group and its activities
            setAllActivityCheckboxes(false);
            cb.checked = true;
            cb.indeterminate = false;
            const subsContainer = elements.activityTree.querySelector('.activity-subs[data-group="' + cb.dataset.group + '"]');
            if (subsContainer) {
               subsContainer.querySelectorAll('input[data-type="activity"]').forEach(a => a.checked = true);
            }
            // Set parent super to indeterminate
            const superSlug = cb.dataset.super;
            if (superSlug) {
               const superCb = document.getElementById('actsuper-' + superSlug);
               if (superCb) { superCb.checked = false; superCb.indeterminate = true; }
            }
            updateActivityFilters();
            syncActivityMasterCheckbox();

         } else if (dataType === 'activity') {
            // Solo this activity: uncheck all, check only this one
            setAllActivityCheckboxes(false);
            cb.checked = true;
            // Set parent group to indeterminate
            const groupSlug = cb.closest('.activity-subs')?.dataset.group;
            if (groupSlug) {
               const groupCb = document.getElementById('actgrp-' + groupSlug);
               if (groupCb) {
                  groupCb.checked = false;
                  groupCb.indeterminate = true;
                  // Set parent super to indeterminate
                  const superSlug = groupCb.dataset.super;
                  if (superSlug) {
                     const superCb = document.getElementById('actsuper-' + superSlug);
                     if (superCb) { superCb.checked = false; superCb.indeterminate = true; }
                  }
               }
            }
            updateActivityFilters();
            syncActivityMasterCheckbox();

         } else if (dataType === 'coauthor') {
            // Solo this coauthor
            setAllCoauthorCheckboxes(false);
            cb.checked = true;
            updateCoauthorFilters();
            syncCoauthorMasterCheckbox();

         } else if (dataType === 'affiliation') {
            // Solo this affiliation
            setAllAffiliationCheckboxes(false);
            cb.checked = true;
            updateAffiliationFilters();
            syncAffiliationMasterCheckbox();

         } else if (dataType === 'collaboration') {
            // Solo this collaboration
            setAllCollaborationCheckboxes(false);
            cb.checked = true;
            updateCollaborationFilters();
            syncCollaborationMasterCheckbox();
         }

         applyFiltersAndRender();
      });
   }

   // Highlight filters (awards, etc.)
   function setupHighlightFilters() {
      if (elements.awardFilterCheckbox) {
         elements.awardFilterCheckbox.addEventListener('change', () => {
            state.filters.awardOnly = elements.awardFilterCheckbox.checked;
            applyFiltersAndRender();
         });
      }
      if (elements.hasCodeFilterCheckbox) {
         elements.hasCodeFilterCheckbox.addEventListener('change', () => {
            state.filters.hasCodeOnly = elements.hasCodeFilterCheckbox.checked;
            applyFiltersAndRender();
         });
      }
      if (elements.hasDatasetFilterCheckbox) {
         elements.hasDatasetFilterCheckbox.addEventListener('change', () => {
            state.filters.hasDatasetOnly = elements.hasDatasetFilterCheckbox.checked;
            applyFiltersAndRender();
         });
      }
      if (elements.reproducibleFilterCheckbox) {
         elements.reproducibleFilterCheckbox.addEventListener('change', () => {
            state.filters.reproducibleOnly = elements.reproducibleFilterCheckbox.checked;
            applyFiltersAndRender();
         });
      }
   }

   // Add count badges to type labels in the sidebar
   function updateTypeCounts() {
      const typeCounts = {};
      allPublications.forEach(pub => {
         const t = getPublicationType(pub);
         typeCounts[t] = (typeCounts[t] || 0) + 1;
      });

      elements.typeCheckboxes.forEach(cb => {
         const type = cb.value;
         const count = typeCounts[type] || 0;
         const label = cb.closest('.form-check')?.querySelector('.form-check-label');
         if (label && count > 0) {
            // Remove existing badge if any
            const existingBadge = label.querySelector('.pub-count');
            if (!existingBadge) {
               const badge = document.createElement('span');
               badge.className = 'pub-count ms-auto';
               badge.setAttribute('data-total', count.toString());
               badge.setAttribute('data-filter-dim', 'pubtype');
               badge.setAttribute('data-filter-val', type);
               badge.textContent = count + ' / ' + count;
               label.classList.add('d-flex', 'justify-content-between', 'align-items-center');
               label.style.width = '100%';
               label.appendChild(badge);
            }
         }
      });
   }
   
   // Venue ordering: grouped by category, prestige descending within each group.
   // Venues not listed here appear at the end under "Other".
   const VENUE_ORDER = {
      'Journals': ['TNSM', 'JSAC', 'CCR', 'Computer Networks', 'IET Comm'],
      'Conferences': ['INFOCOM', 'CoNEXT', 'ACM ICN', 'SIGCOMM Demos', 'IFIP IM', 'PAM', 'DRCN', 'ITC', 'TridentCom', 'NGI', 'CFI'],
      'Workshops': ['LANMAN', 'AIMS', 'FIRE-GENI', 'GEC', 'EuroNGI', 'Congestion Control WS']
   };

   // Flat ordered list of all known venues for sorting
   const VENUE_FLAT_ORDER = Object.values(VENUE_ORDER).flat();

   // Mapping from VENUE_ORDER group to parent pubtype value
   const VENUE_GROUP_TO_TYPE = {
      'Journals': 'journal',
      'Conferences': 'conference',
      'Workshops': 'workshop'
   };

   // Conference name to official website mapping
   const CONFERENCE_WEBSITES = {
      'ACM SIGCOMM': 'https://www.sigcomm.org/sigcomm-conference',
      'ACM ICN': 'https://conferences.sigcomm.org/acm-icn',
      'CoNEXT': 'https://www.sigcomm.org/conext-conference',
      'INFOCOM': 'https://www.ieee-infocom.org',
      'SIGCOMM Demos': 'https://www.sigcomm.org/sigcomm-conference',
      'IFIP IM': 'https://www.ifip.org',
      'PAM': 'https://www.pam-conference.org',
      'DRCN': 'https://www.drcn.org',
      'ITC': 'https://www.itc-conference.org'
   };

   function buildVenueSubCheckboxes() {
      // Collect venue counts from all publications
      const venueCounts = {};
      allPublications.forEach(pub => {
         const venue = getPublicationVenue(pub);
         if (venue) {
            venueCounts[venue] = (venueCounts[venue] || 0) + 1;
         }
      });

      if (Object.keys(venueCounts).length === 0) return;

      // Place venues into their parent type containers
      for (const [groupLabel, venues] of Object.entries(VENUE_ORDER)) {
         const parentType = VENUE_GROUP_TO_TYPE[groupLabel];
         if (!parentType) continue;

         const container = document.querySelector('.pubtype-venues[data-parent-type="' + parentType + '"]');
         if (!container) continue;

         const activeVenues = venues.filter(v => venueCounts[v]);
         if (activeVenues.length === 0) {
            container.style.display = 'none';
            continue;
         }

         container.innerHTML = '';
         activeVenues.forEach(venue => {
            container.appendChild(createVenueCheckbox(venue, venueCounts[venue]));
         });
      }

      // Unknown venues (not in VENUE_ORDER) are still counted for filtering
      // but don't get sub-checkboxes — they pass through the parent type filter only
      const knownVenues = new Set(VENUE_FLAT_ORDER);

      // Initialize state with all venues checked
      state.filters.venues = Object.keys(venueCounts);
   }

   function createVenueCheckbox(venue, count) {
      const id = 'venue-' + venue.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const div = document.createElement('div');
      div.className = 'form-check';
      
      // Check if this venue has a conference website
      const confUrl = CONFERENCE_WEBSITES[venue];
      const confLink = confUrl ? '<a href="' + confUrl + '" target="_blank" rel="noopener" class="venue-ext-link" title="Visit ' + venue + ' website"><i class="fa-solid fa-up-right-from-square"></i></a>' : '';
      
      // Badge will show filtered/total counts (placeholder for total, updated on render)
      const badgeHtml = '<span class="pub-count venue-badge" data-venue="' + venue + '" data-filter-dim="venue" data-filter-val="' + venue + '" data-total="' + count + '" style="cursor: pointer;" title="Click to filter by this venue">' + count + ' / ' + count + '</span>';
      
      div.innerHTML =
         '<input class="form-check-input" type="checkbox" id="' + id + '" data-type="venue" value="' + venue + '" checked>' +
         '<label class="form-check-label d-flex justify-content-between align-items-center" for="' + id + '">' +
         '<span>' + venue + confLink + '</span>' +
         badgeHtml +
         '</label>';
      return div;
   }

   // Venue filter events are handled by setupTypeFilters() via delegation on pubtypeTree
   
   // Research activity hierarchy: tracks → activities (matching bib project: tags after alias)
   // Ordered chronologically (most recent first) to match the research page.
   // Research activity hierarchy — two-level structure matching the research page.
   // Super-groups → topic groups → individual activity slugs (from bib project: tags).
   const ACTIVITY_HIERARCHY = {
      'Current Research': {
         'Agentic AI': ['agentic-ai']
      },
      'Previous Research': {
         'Cloud Security': ['cloud-security'],
         'Information-Centric Networking': ['icn', 'hybrid-icn'],
         'Internet Measurements': ['internet-measurements', 'anycast'],
         'Testbed Federation': ['testbed-federation'],
         'Flow-Aware Networking': ['flow-aware-networking']
      }
   };

   const ACTIVITY_LABELS = {
      'agentic-ai': 'Agentic AI & network validation',
      'cloud-security': 'Cloud threat detections',
      'hybrid-icn': 'Hybrid ICN & hICN',
      'icn': 'ICN foundations & MAP-Me',
      'internet-measurements': 'Internet measurements',
      'testbed-federation': 'Testbed federation',
      'flow-aware-networking': 'Flow-aware networking',
      'anycast': 'Anycast'
   };

   // External links shown next to activity group labels
   const ACTIVITY_GROUP_LINKS = {
      'Agentic AI': 'http://aaif.org/'
   };

   const ACTIVITY_FLAT = Object.values(ACTIVITY_HIERARCHY).flatMap(groups => Object.values(groups).flat());

   function buildActivityCheckboxes() {
      if (!elements.activityTree) return;

      // Collect activity counts from publications
      const activityCounts = {};
      allPublications.forEach(pub => {
         const projects = getPublicationProjects(pub);
         projects.forEach(p => {
            activityCounts[p] = (activityCounts[p] || 0) + 1;
         });
      });

      if (Object.keys(activityCounts).length === 0) {
         if (elements.activityFilterSection) elements.activityFilterSection.style.display = 'none';
         return;
      }

      const container = elements.activityTree;
      container.innerHTML = '';

      const knownActivities = new Set(ACTIVITY_FLAT);
      const unknownActivities = Object.keys(activityCounts).filter(a => !knownActivities.has(a)).sort();

      // Build three-tier: super-group → group → activities
      for (const [superLabel, groups] of Object.entries(ACTIVITY_HIERARCHY)) {
         // Check if any activities in this super-group have publications
         const superHasAny = Object.values(groups).some(acts => acts.some(a => activityCounts[a]));
         if (!superHasAny) continue;

         const superSlug = superLabel.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
         const superCount = Object.values(groups).flat().reduce((sum, a) => sum + (activityCounts[a] || 0), 0);

         // Super-group container
         const superDiv = document.createElement('div');
         superDiv.className = 'activity-super-node';

         // Super-group checkbox with count
         const superCheck = document.createElement('div');
         superCheck.className = 'form-check';
         superCheck.innerHTML =
            '<input class="form-check-input" type="checkbox" id="actsuper-' + superSlug + '" data-type="actsuper" data-super="' + superSlug + '" checked>' +
            '<label class="form-check-label d-flex justify-content-between align-items-center" for="actsuper-' + superSlug + '">' +
            '<strong>' + superLabel + '</strong>' +
            '<span class="pub-count" data-filter-dim="actsuper" data-filter-val="' + superSlug + '" data-total="' + superCount + '">' + superCount + ' / ' + superCount + '</span>' +
            '</label>';
         superDiv.appendChild(superCheck);

         // Groups container
         const groupsDiv = document.createElement('div');
         groupsDiv.className = 'activity-groups';
         groupsDiv.dataset.super = superSlug;

         for (const [groupLabel, activities] of Object.entries(groups)) {
            const active = activities.filter(a => activityCounts[a]);
            if (active.length === 0) continue;

            const groupSlug = groupLabel.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const groupCount = active.reduce((sum, a) => sum + (activityCounts[a] || 0), 0);

            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'activity-node';

            // Group-level checkbox with count
            const groupCheck = document.createElement('div');
            groupCheck.className = 'form-check';
            const groupExtUrl = ACTIVITY_GROUP_LINKS[groupLabel];
            const groupExtLink = groupExtUrl ? '<a href="' + groupExtUrl + '" target="_blank" rel="noopener" class="venue-ext-link ms-auto me-1" title="Visit ' + groupLabel + ' website"><i class="fa-solid fa-up-right-from-square"></i></a>' : '';
            groupCheck.innerHTML =
               '<input class="form-check-input" type="checkbox" id="actgrp-' + groupSlug + '" data-type="actgroup" data-group="' + groupSlug + '" data-super="' + superSlug + '" checked>' +
               '<label class="form-check-label d-flex align-items-center" for="actgrp-' + groupSlug + '">' +
               '<span class="me-auto">' + groupLabel + '</span>' +
               groupExtLink +
               '<span class="pub-count" data-filter-dim="actgroup" data-filter-val="' + groupSlug + '" data-total="' + groupCount + '">' + groupCount + ' / ' + groupCount + '</span>' +
               '</label>';
            nodeDiv.appendChild(groupCheck);

            // Sub-activity checkboxes
            if (active.length > 1) {
               const subsDiv = document.createElement('div');
               subsDiv.className = 'activity-subs';
               subsDiv.dataset.group = groupSlug;
               active.forEach(activity => {
                  subsDiv.appendChild(createActivityCheckbox(activity, activityCounts[activity]));
               });
               nodeDiv.appendChild(subsDiv);
            } else {
               // Single activity — hidden sub-checkbox for uniform state logic
               const subsDiv = document.createElement('div');
               subsDiv.className = 'activity-subs activity-subs-single';
               subsDiv.dataset.group = groupSlug;
               subsDiv.style.display = 'none';
               active.forEach(activity => {
                  subsDiv.appendChild(createActivityCheckbox(activity, activityCounts[activity]));
               });
               nodeDiv.appendChild(subsDiv);
            }

            groupsDiv.appendChild(nodeDiv);
         }

         superDiv.appendChild(groupsDiv);
         container.appendChild(superDiv);
      }

      // Unknown activities go under "Other"
      if (unknownActivities.length > 0) {
         const nodeDiv = document.createElement('div');
         nodeDiv.className = 'activity-node';
         const groupCheck = document.createElement('div');
         groupCheck.className = 'form-check';
         groupCheck.innerHTML =
            '<input class="form-check-input" type="checkbox" id="actgrp-other" data-type="actgroup" data-group="other" checked>' +
            '<label class="form-check-label" for="actgrp-other">Other</label>';
         nodeDiv.appendChild(groupCheck);

         const subsDiv = document.createElement('div');
         subsDiv.className = 'activity-subs';
         subsDiv.dataset.group = 'other';
         unknownActivities.forEach(activity => {
            subsDiv.appendChild(createActivityCheckbox(activity, activityCounts[activity]));
         });
         nodeDiv.appendChild(subsDiv);
         container.appendChild(nodeDiv);
      }

      state.filters.activities = Object.keys(activityCounts);
   }

   function createActivityCheckbox(activity, count) {
      const id = 'activity-' + activity;
      const label = ACTIVITY_LABELS[activity] || activity;
      const div = document.createElement('div');
      div.className = 'form-check';
      div.innerHTML =
         '<input class="form-check-input" type="checkbox" id="' + id + '" data-type="activity" value="' + activity + '" checked>' +
         '<label class="form-check-label d-flex justify-content-between align-items-center" for="' + id + '">' +
         '<span>' + label + '</span>' +
         '<span class="pub-count" data-filter-dim="activity" data-filter-val="' + activity + '" data-total="' + count + '">' + count + ' / ' + count + '</span>' +
         '</label>';
      return div;
   }

   // ---- Activity tri-state helpers (three tiers: master → super → group → activity) ----

   function setAllActivityCheckboxes(checked) {
      if (!elements.activityTree) return;
      elements.activityTree.querySelectorAll('input[data-type="actsuper"], input[data-type="actgroup"], input[data-type="activity"]').forEach(cb => {
         cb.checked = checked;
         cb.indeterminate = false;
      });
   }

   function syncActivityGroupCheckbox(groupSlug) {
      const groupCb = document.getElementById('actgrp-' + groupSlug);
      const subsContainer = elements.activityTree.querySelector('.activity-subs[data-group="' + groupSlug + '"]');
      if (!groupCb || !subsContainer) return;

      const subCbs = subsContainer.querySelectorAll('input[data-type="activity"]');
      if (subCbs.length === 0) return;

      const checkedCount = Array.from(subCbs).filter(cb => cb.checked).length;
      if (checkedCount === 0) {
         groupCb.checked = false;
         groupCb.indeterminate = false;
      } else if (checkedCount === subCbs.length) {
         groupCb.checked = true;
         groupCb.indeterminate = false;
      } else {
         groupCb.checked = false;
         groupCb.indeterminate = true;
      }
   }

   function syncActivitySuperCheckbox(superSlug) {
      const superCb = document.getElementById('actsuper-' + superSlug);
      const groupsContainer = elements.activityTree.querySelector('.activity-groups[data-super="' + superSlug + '"]');
      if (!superCb || !groupsContainer) return;

      const groupCbs = groupsContainer.querySelectorAll('input[data-type="actgroup"]');
      if (groupCbs.length === 0) return;

      const checkedCount = Array.from(groupCbs).filter(cb => cb.checked).length;
      const anyIndeterminate = Array.from(groupCbs).some(cb => cb.indeterminate);

      if (checkedCount === 0 && !anyIndeterminate) {
         superCb.checked = false;
         superCb.indeterminate = false;
      } else if (checkedCount === groupCbs.length && !anyIndeterminate) {
         superCb.checked = true;
         superCb.indeterminate = false;
      } else {
         superCb.checked = false;
         superCb.indeterminate = true;
      }
   }

   function syncActivityMasterCheckbox() {
      if (!elements.activityMasterCheckbox || !elements.activityTree) return;

      const superCbs = Array.from(elements.activityTree.querySelectorAll('input[data-type="actsuper"]'));
      if (superCbs.length === 0) {
         // Fallback: check all groups directly (for "Other" without super-group)
         const allCbs = Array.from(elements.activityTree.querySelectorAll('input[data-type="actgroup"], input[data-type="activity"]'));
         const total = allCbs.length;
         const checked = allCbs.filter(cb => cb.checked).length;
         elements.activityMasterCheckbox.checked = checked === total;
         elements.activityMasterCheckbox.indeterminate = checked > 0 && checked < total;
         return;
      }

      const checkedCount = superCbs.filter(cb => cb.checked).length;
      const anyIndeterminate = superCbs.some(cb => cb.indeterminate);

      if (checkedCount === 0 && !anyIndeterminate) {
         elements.activityMasterCheckbox.checked = false;
         elements.activityMasterCheckbox.indeterminate = false;
      } else if (checkedCount === superCbs.length && !anyIndeterminate) {
         elements.activityMasterCheckbox.checked = true;
         elements.activityMasterCheckbox.indeterminate = false;
      } else {
         elements.activityMasterCheckbox.checked = false;
         elements.activityMasterCheckbox.indeterminate = true;
      }
   }

   function setupActivityFilters() {
      // Master tri-state checkbox
      if (elements.activityMasterCheckbox) {
         elements.activityMasterCheckbox.addEventListener('change', () => {
            const checked = elements.activityMasterCheckbox.checked;
            elements.activityMasterCheckbox.indeterminate = false;
            setAllActivityCheckboxes(checked);
            updateActivityFilters();
            applyFiltersAndRender();
         });
      }

      // Delegated events on the tree
      if (elements.activityTree) {
         elements.activityTree.addEventListener('change', (e) => {
            if (e.target.matches('input[data-type="actsuper"]')) {
               // Super-group toggled — propagate to all groups and activities under it
               const superSlug = e.target.dataset.super;
               const checked = e.target.checked;
               e.target.indeterminate = false;
               const groupsContainer = elements.activityTree.querySelector('.activity-groups[data-super="' + superSlug + '"]');
               if (groupsContainer) {
                  groupsContainer.querySelectorAll('input[data-type="actgroup"], input[data-type="activity"]').forEach(cb => {
                     cb.checked = checked;
                     cb.indeterminate = false;
                  });
               }
               updateActivityFilters();
               syncActivityMasterCheckbox();
               applyFiltersAndRender();

            } else if (e.target.matches('input[data-type="actgroup"]')) {
               // Group checkbox toggled — propagate to children, sync super-group
               const groupSlug = e.target.dataset.group;
               const subsContainer = elements.activityTree.querySelector('.activity-subs[data-group="' + groupSlug + '"]');
               if (subsContainer) {
                  subsContainer.querySelectorAll('input[data-type="activity"]').forEach(cb => {
                     cb.checked = e.target.checked;
                  });
               }
               e.target.indeterminate = false;
               // Sync the parent super-group
               const superSlug = e.target.dataset.super;
               if (superSlug) syncActivitySuperCheckbox(superSlug);
               updateActivityFilters();
               syncActivityMasterCheckbox();
               applyFiltersAndRender();

            } else if (e.target.matches('input[data-type="activity"]')) {
               // Child activity toggled — sync parent group, then super-group, then master
               const groupSlug = e.target.closest('.activity-subs')?.dataset.group;
               if (groupSlug) {
                  syncActivityGroupCheckbox(groupSlug);
                  const groupCb = document.getElementById('actgrp-' + groupSlug);
                  const superSlug = groupCb?.dataset.super;
                  if (superSlug) syncActivitySuperCheckbox(superSlug);
               }
               updateActivityFilters();
               syncActivityMasterCheckbox();
               applyFiltersAndRender();
            }
         });
      }
   }
   
   function setupDateRangeFilters() {
      if (!elements.yearRangeSlider || typeof noUiSlider === 'undefined') {
         console.warn('noUiSlider not available for publications');
         return;
      }

      const dateRangeContainer = elements.yearRangeSlider.closest('.date-range-filter');
      
      // Use restored state or defaults
      const initialStart = state.filters.dateRange.start || yearBounds.min;
      const initialEnd = state.filters.dateRange.end || yearBounds.max;
      
      // Initialize noUiSlider with dual handles
      noUiSlider.create(elements.yearRangeSlider, {
         start: [initialStart, initialEnd],
         connect: true,
         step: 1,
         range: {
            'min': yearBounds.min,
            'max': yearBounds.max
         },
         tooltips: [
            { to: value => String(Math.round(value)) },
            { to: value => String(Math.round(value)) }
         ],
         format: {
            to: value => Math.round(value),
            from: value => Math.round(value)
         }
      });

      if (dateRangeContainer) {
         dateRangeContainer.classList.add('is-enhanced');
      }
      
      // Update badges and filter on slider change
      elements.yearRangeSlider.noUiSlider.on('update', (values) => {
         const startYear = parseInt(values[0]);
         const endYear = parseInt(values[1]);
         
         elements.startYearDisplay.textContent = startYear;
         elements.endYearDisplay.textContent = endYear;
         
         state.filters.dateRange.start = startYear;
         state.filters.dateRange.end = endYear;
      });
      
      // Apply filters on slider change (debounced)
      elements.yearRangeSlider.noUiSlider.on('change', () => {
         applyFiltersAndRender();
      });
   }
   
   function setupResetButtons() {
      // Reset date filter
      if (elements.resetDateBtn) {
         elements.resetDateBtn.addEventListener('click', () => {
            resetDateFilter();
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
   // Collapsible categories
   // ============================================================================
   
   function setupCollapsibles() {
      // All btn-collapse-toggle buttons (venue toggles + coauthor/affiliation/collaboration trees)
      document.querySelectorAll('.btn-collapse-toggle[data-collapse-target]').forEach(btn => {
         btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.collapseTarget;
            const target = document.getElementById(targetId);
            if (!target) return;
            const isCollapsed = target.classList.toggle('collapsed');
            btn.classList.toggle('collapsed', isCollapsed);
            btn.setAttribute('aria-expanded', String(!isCollapsed));
            state.collapsed[targetId] = isCollapsed;
            saveState();
         });
      });

      // Restore saved collapse state for tree sections
      ['coauthor-tree', 'affiliation-tree', 'collaboration-tree'].forEach(id => {
         const target = document.getElementById(id);
         const btn = document.querySelector('.btn-collapse-toggle[data-collapse-target="' + id + '"]');
         if (!target || !btn) return;
         const saved = state.collapsed[id];
         // Default: collapsed (true). Only expand if explicitly saved as false.
         const shouldCollapse = saved !== false;
         target.classList.toggle('collapsed', shouldCollapse);
         btn.classList.toggle('collapsed', shouldCollapse);
         btn.setAttribute('aria-expanded', String(!shouldCollapse));
      });

      // Activity group toggles — add toggle buttons dynamically
      if (elements.activityTree) {
         elements.activityTree.querySelectorAll('.activity-node').forEach(node => {
            const subsDiv = node.querySelector('.activity-subs:not(.activity-subs-single)');
            if (!subsDiv) return;
            const groupSlug = subsDiv.dataset.group;
            if (!groupSlug) return;

            const collapseId = 'actsubs-' + groupSlug;
            subsDiv.id = collapseId;
            subsDiv.classList.add('collapsible');

            // Default: collapsed unless restored from state
            const shouldCollapse = state.collapsed[collapseId] !== undefined
               ? state.collapsed[collapseId]
               : true; // activity subs collapsed by default
            if (shouldCollapse) {
               subsDiv.classList.add('collapsed');
            }

            // Add toggle button to the group checkbox line
            const groupCheck = node.querySelector('.form-check');
            if (groupCheck) {
               const btn = document.createElement('button');
               btn.className = 'btn-collapse-toggle' + (shouldCollapse ? ' collapsed' : '');
               btn.dataset.collapseTarget = collapseId;
               btn.setAttribute('aria-expanded', String(!shouldCollapse));
               btn.innerHTML = '<i class="bi bi-chevron-down"></i>';
               btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  const isCollapsed = subsDiv.classList.toggle('collapsed');
                  btn.classList.toggle('collapsed', isCollapsed);
                  btn.setAttribute('aria-expanded', String(!isCollapsed));
                  state.collapsed[collapseId] = isCollapsed;
                  saveState();
               });
               groupCheck.appendChild(btn);
            }
         });
      }

      // Apply saved collapse state to venue containers
      document.querySelectorAll('.pubtype-venues.collapsible').forEach(container => {
         if (!container.id) return;
         const saved = state.collapsed[container.id];
         if (saved === true) {
            container.classList.add('collapsed');
            const btn = document.querySelector('.btn-collapse-toggle[data-collapse-target="' + container.id + '"]');
            if (btn) {
               btn.classList.add('collapsed');
               btn.setAttribute('aria-expanded', 'false');
            }
         } else if (saved === false) {
            container.classList.remove('collapsed');
            const btn = document.querySelector('.btn-collapse-toggle[data-collapse-target="' + container.id + '"]');
            if (btn) {
               btn.classList.remove('collapsed');
               btn.setAttribute('aria-expanded', 'true');
            }
         }
      });
   }
   
   // ============================================================================
   // State persistence
   // ============================================================================
   
   function saveState() {
      try {
         const toSave = {
            filters: {
               types: state.filters.types,
               venues: state.filters.venues,
               activities: state.filters.activities,
               coauthors: state.filters.coauthors,
               affiliations: state.filters.affiliations,
               collaborations: state.filters.collaborations,
               dateRange: state.filters.dateRange,
               awardOnly: state.filters.awardOnly,
               hasCodeOnly: state.filters.hasCodeOnly,
               hasDatasetOnly: state.filters.hasDatasetOnly,
               reproducibleOnly: state.filters.reproducibleOnly
            },
            collapsed: state.collapsed,
            available: {
               types: Array.from(elements.typeCheckboxes).map((cb) => cb.value),
               venues: getAvailableValues('input[data-type="venue"]'),
               activities: getAvailableValues('input[data-type="activity"]'),
               coauthors: getAvailableValues('input[data-type="coauthor"]'),
               affiliations: getAvailableValues('input[data-type="affiliation"]'),
               collaborations: getAvailableValues('input[data-type="collaboration"]')
            }
         };
         localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
         // localStorage unavailable — silently ignore
      }
   }
   
   function restoreState() {
      try {
         const raw = localStorage.getItem(STORAGE_KEY);
         if (!raw) return;

         const saved = JSON.parse(raw);
         if (!saved || typeof saved !== 'object') return;

         const savedFilters = saved.filters && typeof saved.filters === 'object' ? saved.filters : {};
         const savedAvailable = saved.available && typeof saved.available === 'object' ? saved.available : {};

         // Stable top-level type filters: restore exact checked state.
         if (Array.isArray(savedFilters.types)) {
            const savedTypes = new Set(savedFilters.types);
            elements.typeCheckboxes.forEach((cb) => {
               cb.checked = savedTypes.has(cb.value);
               cb.indeterminate = false;
            });
            state.filters.types = Array.from(savedTypes);
         }

         // Dynamic filters: restore previous selections and auto-check newly introduced values.
         restoreDynamicCheckboxState('input[data-type="venue"]', savedFilters.venues, savedAvailable.venues);
         restoreDynamicCheckboxState('input[data-type="activity"]', savedFilters.activities, savedAvailable.activities);
         restoreDynamicCheckboxState('input[data-type="coauthor"]', savedFilters.coauthors, savedAvailable.coauthors);
         restoreDynamicCheckboxState('input[data-type="affiliation"]', savedFilters.affiliations, savedAvailable.affiliations);
         restoreDynamicCheckboxState('input[data-type="collaboration"]', savedFilters.collaborations, savedAvailable.collaborations);

         // Keep parent tri-state checkboxes consistent with restored children.
         ['journal', 'conference', 'workshop'].forEach((t) => syncParentTypeCheckbox(t));
         if (elements.activityTree) {
            elements.activityTree.querySelectorAll('input[data-type="actgroup"]').forEach((gcb) => {
               const slug = gcb.dataset.group;
               if (slug) syncActivityGroupCheckbox(slug);
            });
            elements.activityTree.querySelectorAll('input[data-type="actsuper"]').forEach((scb) => {
               const slug = scb.dataset.super;
               if (slug) syncActivitySuperCheckbox(slug);
            });
         }

         // Restore date range within current bounds.
         if (savedFilters.dateRange && typeof savedFilters.dateRange.start === 'number' && typeof savedFilters.dateRange.end === 'number') {
            const start = Math.max(yearBounds.min, Math.min(yearBounds.max, savedFilters.dateRange.start));
            const end = Math.max(start, Math.min(yearBounds.max, savedFilters.dateRange.end));
            state.filters.dateRange = { start: start, end: end };
            if (elements.startYearDisplay) elements.startYearDisplay.textContent = start;
            if (elements.endYearDisplay) elements.endYearDisplay.textContent = end;
         }

         // Restore highlight filters.
         state.filters.awardOnly = !!savedFilters.awardOnly;
         state.filters.hasCodeOnly = !!savedFilters.hasCodeOnly;
         state.filters.hasDatasetOnly = !!savedFilters.hasDatasetOnly;
         state.filters.reproducibleOnly = !!savedFilters.reproducibleOnly;
         if (elements.awardFilterCheckbox) elements.awardFilterCheckbox.checked = state.filters.awardOnly;
         if (elements.hasCodeFilterCheckbox) elements.hasCodeFilterCheckbox.checked = state.filters.hasCodeOnly;
         if (elements.hasDatasetFilterCheckbox) elements.hasDatasetFilterCheckbox.checked = state.filters.hasDatasetOnly;
         if (elements.reproducibleFilterCheckbox) elements.reproducibleFilterCheckbox.checked = state.filters.reproducibleOnly;

         // Restore collapse state.
         if (saved.collapsed && typeof saved.collapsed === 'object') {
            state.collapsed = saved.collapsed;
         }

         // Recompute in-memory filter arrays from the actual checkbox state.
         updateTypeFilters();
         updateVenueFilters();
         updateActivityFilters();
         updateCoauthorFilters();
         updateAffiliationFilters();
         updateCollaborationFilters();
      } catch (e) {
         // Corrupted data — ignore and keep defaults
      }
   }

   function clearLegacySavedState() {
      try {
         LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
         // localStorage unavailable — silently ignore
      }
   }

   function getAvailableValues(selector) {
      return Array.from(document.querySelectorAll(selector)).map((cb) => cb.value);
   }

   function restoreDynamicCheckboxState(selector, savedCheckedValues, savedAvailableValues) {
      const checkboxes = Array.from(document.querySelectorAll(selector));
      if (checkboxes.length === 0) return;

      // If old state has no compatible availability snapshot, default to fully checked
      // to avoid hidden publications that the UI cannot explain.
      if (!Array.isArray(savedCheckedValues) || !Array.isArray(savedAvailableValues)) {
         checkboxes.forEach((cb) => { cb.checked = true; });
         return;
      }

      const savedChecked = new Set(savedCheckedValues);
      const oldAvailable = new Set(savedAvailableValues);

      checkboxes.forEach((cb) => {
         const value = cb.value;
         if (!oldAvailable.has(value)) {
            // Newly introduced value: checked by default so new content stays visible.
            cb.checked = true;
         } else {
            cb.checked = savedChecked.has(value);
         }
      });
   }

   // ============================================================================
   // Filter Updates
   // ============================================================================
   
   function updateTypeFilters() {
      state.filters.types = [];
      elements.typeCheckboxes.forEach(checkbox => {
         // Include fully checked AND indeterminate (partially checked venues)
         if (checkbox.checked || checkbox.indeterminate) {
            state.filters.types.push(checkbox.value);
         }
      });
      console.log('📑 Type filters:', state.filters.types);
   }
   
   function updateVenueFilters() {
      state.filters.venues = [];
      if (elements.pubtypeTree) {
         elements.pubtypeTree.querySelectorAll('input[data-type="venue"]').forEach(cb => {
            if (cb.checked) state.filters.venues.push(cb.value);
         });
      }
      console.log('🏛 Venue filters:', state.filters.venues);
   }

   /**
    * Returns true when some (but not all) venue sub-checkboxes for a given
    * parent type are unchecked — meaning the user is actively narrowing by
    * venue within that type.  Types with no venue sub-checkboxes are never
    * considered to be narrowing.
    */
   function isVenueNarrowingActive(pubType) {
      const container = document.querySelector('.pubtype-venues[data-parent-type="' + pubType + '"]');
      if (!container) return false;
      const all = container.querySelectorAll('input[data-type="venue"]');
      if (all.length === 0) return false;
      const checked = container.querySelectorAll('input[data-type="venue"]:checked');
      return checked.length < all.length;
   }
   
   function updateActivityFilters() {
      state.filters.activities = [];
      if (elements.activityTree) {
         elements.activityTree.querySelectorAll('input[data-type="activity"]').forEach(cb => {
            if (cb.checked) state.filters.activities.push(cb.value);
         });
      }
      console.log('🔬 Activity filters:', state.filters.activities);
   }
   
   function resetDateFilter() {
      state.filters.dateRange = { start: yearBounds.min, end: yearBounds.max };
      
      // Reset noUiSlider if it exists
      if (elements.yearRangeSlider && elements.yearRangeSlider.noUiSlider) {
         elements.yearRangeSlider.noUiSlider.set([yearBounds.min, yearBounds.max]);
      }
      
      // Update display badges
      if (elements.startYearDisplay) elements.startYearDisplay.textContent = yearBounds.min;
      if (elements.endYearDisplay) elements.endYearDisplay.textContent = yearBounds.max;
   }
   
   function resetAllFilters() {
      // Reset types + venues (check all, clear indeterminate)
      setAllTypeAndVenueCheckboxes(true);

      updateTypeFilters();
      updateVenueFilters();
      
      // Reset activities (check all + clear indeterminate)
      setAllActivityCheckboxes(true);
      if (elements.activityMasterCheckbox) {
         elements.activityMasterCheckbox.checked = true;
         elements.activityMasterCheckbox.indeterminate = false;
      }
      updateActivityFilters();

      // Reset coauthors
      setAllCoauthorCheckboxes(true);
      if (elements.coauthorMasterCheckbox) {
         elements.coauthorMasterCheckbox.checked = true;
         elements.coauthorMasterCheckbox.indeterminate = false;
      }
      updateCoauthorFilters();

      // Reset affiliations
      setAllAffiliationCheckboxes(true);
      if (elements.affiliationMasterCheckbox) {
         elements.affiliationMasterCheckbox.checked = true;
         elements.affiliationMasterCheckbox.indeterminate = false;
      }
      updateAffiliationFilters();

      // Reset collaborations
      setAllCollaborationCheckboxes(true);
      if (elements.collaborationMasterCheckbox) {
         elements.collaborationMasterCheckbox.checked = true;
         elements.collaborationMasterCheckbox.indeterminate = false;
      }
      updateCollaborationFilters();
      
      // Reset highlight filters
      state.filters.awardOnly = false;
      state.filters.hasCodeOnly = false;
      state.filters.hasDatasetOnly = false;
      state.filters.reproducibleOnly = false;
      if (elements.awardFilterCheckbox) elements.awardFilterCheckbox.checked = false;
      if (elements.hasCodeFilterCheckbox) elements.hasCodeFilterCheckbox.checked = false;
      if (elements.hasDatasetFilterCheckbox) elements.hasDatasetFilterCheckbox.checked = false;
      if (elements.reproducibleFilterCheckbox) elements.reproducibleFilterCheckbox.checked = false;
      
      // Reset date range
      resetDateFilter();
      
      state.collapsed = {};
      
      // Reset collapse state to defaults
      document.querySelectorAll('.pubtype-venues.collapsible').forEach(container => {
         const parentType = container.dataset.parentType;
         const shouldExpand = DEFAULT_EXPANDED.includes(parentType);
         container.classList.toggle('collapsed', !shouldExpand);
         const btn = document.querySelector('.btn-collapse-toggle[data-collapse-target="' + container.id + '"]');
         if (btn) {
            btn.classList.toggle('collapsed', !shouldExpand);
            btn.setAttribute('aria-expanded', String(shouldExpand));
         }
      });
      document.querySelectorAll('.activity-subs.collapsible').forEach(container => {
         container.classList.add('collapsed');
         const btn = document.querySelector('.btn-collapse-toggle[data-collapse-target="' + container.id + '"]');
         if (btn) {
            btn.classList.add('collapsed');
            btn.setAttribute('aria-expanded', 'false');
         }
      });
      
      console.log('🔄 All publication filters reset');
   }
   
   // ============================================================================
   // Author Metadata Loading
   // ============================================================================

   function loadAuthorMetadata() {
      const el = document.getElementById('author-metadata');
      if (!el) return;
      try {
         authorMetadata = JSON.parse(el.textContent);
         console.log('👤 Loaded author metadata:', Object.keys(authorMetadata.authors || {}).length, 'authors');
      } catch (e) {
         console.warn('Failed to parse author metadata', e);
      }
   }

   function getPublicationAuthors(item) {
      const raw = item.dataset.publicationAuthors;
      if (!raw) return [];
      return raw.split(',').map(s => s.trim()).filter(Boolean);
   }

   function getPublicationAffiliations(item) {
      const raw = item.dataset.publicationAffiliations;
      if (!raw) return [];
      return raw.split(',').map(s => s.trim()).filter(Boolean);
   }

   // ============================================================================
   // Coauthor Filter System
   // ============================================================================

   function buildCoauthorCheckboxes() {
      if (!elements.coauthorTree || !authorMetadata) return;

      // Count publications per coauthor
      const coauthorCounts = {};
      allPublications.forEach(pub => {
         getPublicationAuthors(pub).forEach(slug => {
            coauthorCounts[slug] = (coauthorCounts[slug] || 0) + 1;
         });
      });

      if (Object.keys(coauthorCounts).length === 0) {
         if (elements.coauthorFilterSection) elements.coauthorFilterSection.style.display = 'none';
         return;
      }

      // Sort by count descending
      const sorted = Object.entries(coauthorCounts).sort((a, b) => b[1] - a[1]);

      // Group by current affiliation
      const byAffiliation = {};
      sorted.forEach(([slug, count]) => {
         const meta = authorMetadata.authors[slug];
         const affId = meta ? meta.affiliation : 'unknown';
         const affName = meta ? (meta.affiliationName || affId) : 'Unknown';
         if (!byAffiliation[affId]) {
            byAffiliation[affId] = { name: affName, authors: [] };
         }
         byAffiliation[affId].authors.push({ slug, count, name: meta ? meta.name : slug });
      });

      const container = elements.coauthorTree;
      container.innerHTML = '';
      
      // Build two-level: affiliation → authors
      for (const [affId, group] of Object.entries(byAffiliation)) {
         const groupCount = group.authors.reduce((sum, a) => sum + a.count, 0);
         const groupSlug = affId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

         const nodeDiv = document.createElement('div');
         nodeDiv.className = 'coauthor-affiliation-node';

         // Affiliation header (not a filter itself, just grouping)
         const header = document.createElement('div');
         header.className = 'coauthor-affiliation-header';
         header.innerHTML = '<small class="text-muted">' + group.name + '</small>';
         nodeDiv.appendChild(header);

         // Author checkboxes
         group.authors.forEach(({ slug, count, name }) => {
            const cbId = 'coauthor-' + slug;
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML =
               '<input class="form-check-input" type="checkbox" id="' + cbId + '" data-type="coauthor" value="' + slug + '" checked>' +
               '<label class="form-check-label d-flex justify-content-between align-items-center" for="' + cbId + '">' +
               '<span>' + name + '</span>' +
               '<span class="pub-count" data-filter-dim="coauthor" data-filter-val="' + slug + '" data-total="' + count + '">' + count + ' / ' + count + '</span>' +
               '</label>';
            nodeDiv.appendChild(div);
         });

         container.appendChild(nodeDiv);
      }

      // Init state with all coauthors checked
      state.filters.coauthors = sorted.map(([slug]) => slug);
   }

   function setupCoauthorFilters() {
      if (elements.coauthorMasterCheckbox) {
         elements.coauthorMasterCheckbox.addEventListener('change', () => {
            elements.coauthorMasterCheckbox.indeterminate = false;
            setAllCoauthorCheckboxes(elements.coauthorMasterCheckbox.checked);
            updateCoauthorFilters();
            applyFiltersAndRender();
         });
      }
      if (elements.coauthorTree) {
         elements.coauthorTree.addEventListener('change', (e) => {
            if (e.target.matches('input[data-type="coauthor"]')) {
               updateCoauthorFilters();
               syncCoauthorMasterCheckbox();
               applyFiltersAndRender();
            }
         });
      }
   }

   function setAllCoauthorCheckboxes(checked) {
      if (elements.coauthorTree) {
         elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]').forEach(cb => {
            cb.checked = checked;
         });
      }
   }

   function updateCoauthorFilters() {
      state.filters.coauthors = [];
      if (elements.coauthorTree) {
         elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]').forEach(cb => {
            if (cb.checked) state.filters.coauthors.push(cb.value);
         });
      }
   }

   function syncCoauthorMasterCheckbox() {
      if (!elements.coauthorMasterCheckbox || !elements.coauthorTree) return;
      const all = elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]');
      const checked = elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]:checked');
      if (checked.length === 0) {
         elements.coauthorMasterCheckbox.checked = false;
         elements.coauthorMasterCheckbox.indeterminate = false;
      } else if (checked.length === all.length) {
         elements.coauthorMasterCheckbox.checked = true;
         elements.coauthorMasterCheckbox.indeterminate = false;
      } else {
         elements.coauthorMasterCheckbox.checked = false;
         elements.coauthorMasterCheckbox.indeterminate = true;
      }
   }

   // ============================================================================
   // Affiliation Filter System (user's own institutions)
   // ============================================================================

   // Self-affiliation history: institution IDs from the self-author history
   const SELF_INSTITUTIONS = [
      'cisco-outshift', 'cisco-paris', 'upmc', 'telecom-paristech', 'cambridge', 'orange-labs'
   ];

   function buildAffiliationCheckboxes() {
      if (!elements.affiliationTree || !authorMetadata) return;

      // Count pubs per self-affiliation from data-self-affiliation attribute
      const affCounts = {};
      allPublications.forEach(pub => {
         const selfAff = pub.dataset.selfAffiliation;
         if (selfAff) {
            affCounts[selfAff] = (affCounts[selfAff] || 0) + 1;
         }
      });

      if (Object.keys(affCounts).length === 0) {
         if (elements.affiliationFilterSection) elements.affiliationFilterSection.style.display = 'none';
         return;
      }
      buildAffiliationTree(affCounts);
   }

   function findSelfHistory() {
      if (!authorMetadata || !authorMetadata.authors) return [];
      for (const [slug, meta] of Object.entries(authorMetadata.authors)) {
         if (meta.history && SELF_INSTITUTIONS.includes(meta.affiliation)) {
            // Check if this is the self author by matching any self institution pattern
            if (meta.history.length >= 3) return meta.history; // heuristic: self has most entries
         }
      }
      return [];
   }

   function getSelfAffiliationForYear(history, year) {
      // Parse period "2015–2023" or "2023–present" and find match
      for (const entry of history) {
         const period = entry.period || '';
         const match = period.match(/(\d{4})\s*[–-]\s*(\d{4}|present)/);
         if (match) {
            const start = parseInt(match[1]);
            const end = match[2] === 'present' ? 9999 : parseInt(match[2]);
            if (year >= start && year <= end) {
               return entry.institution;
            }
         }
      }
      return null;
   }

   function buildAffiliationTree(affCounts) {
      const container = elements.affiliationTree;
      container.innerHTML = '';

      // Sort by period (most recent first based on SELF_INSTITUTIONS order)
      const ordered = SELF_INSTITUTIONS.filter(id => affCounts[id]);

      ordered.forEach(instId => {
         const count = affCounts[instId];
         const instName = (authorMetadata.institutions && authorMetadata.institutions[instId])
            ? authorMetadata.institutions[instId].name : instId;
         const cbId = 'aff-' + instId;
         const div = document.createElement('div');
         div.className = 'form-check';
         div.innerHTML =
            '<input class="form-check-input" type="checkbox" id="' + cbId + '" data-type="affiliation" value="' + instId + '" checked>' +
            '<label class="form-check-label d-flex justify-content-between align-items-center" for="' + cbId + '">' +
            '<span>' + instName + '</span>' +
            '<span class="pub-count" data-filter-dim="affiliation" data-filter-val="' + instId + '" data-total="' + count + '">' + count + ' / ' + count + '</span>' +
            '</label>';
         container.appendChild(div);
      });

      state.filters.affiliations = ordered.slice();
   }

   function setupAffiliationFilters() {
      if (elements.affiliationMasterCheckbox) {
         elements.affiliationMasterCheckbox.addEventListener('change', () => {
            elements.affiliationMasterCheckbox.indeterminate = false;
            setAllAffiliationCheckboxes(elements.affiliationMasterCheckbox.checked);
            updateAffiliationFilters();
            applyFiltersAndRender();
         });
      }
      if (elements.affiliationTree) {
         elements.affiliationTree.addEventListener('change', (e) => {
            if (e.target.matches('input[data-type="affiliation"]')) {
               updateAffiliationFilters();
               syncAffiliationMasterCheckbox();
               applyFiltersAndRender();
            }
         });
      }
   }

   function setAllAffiliationCheckboxes(checked) {
      if (elements.affiliationTree) {
         elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]').forEach(cb => cb.checked = checked);
      }
   }

   function updateAffiliationFilters() {
      state.filters.affiliations = [];
      if (elements.affiliationTree) {
         elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]').forEach(cb => {
            if (cb.checked) state.filters.affiliations.push(cb.value);
         });
      }
   }

   function syncAffiliationMasterCheckbox() {
      if (!elements.affiliationMasterCheckbox || !elements.affiliationTree) return;
      const all = elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]');
      const checked = elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]:checked');
      if (checked.length === 0) {
         elements.affiliationMasterCheckbox.checked = false;
         elements.affiliationMasterCheckbox.indeterminate = false;
      } else if (checked.length === all.length) {
         elements.affiliationMasterCheckbox.checked = true;
         elements.affiliationMasterCheckbox.indeterminate = false;
      } else {
         elements.affiliationMasterCheckbox.checked = false;
         elements.affiliationMasterCheckbox.indeterminate = true;
      }
   }

   // ============================================================================
   // Collaboration Filter System (coauthor institutions)
   // ============================================================================

   function buildCollaborationCheckboxes() {
      if (!elements.collaborationTree || !authorMetadata) return;

      // Count pubs per coauthor institution
      const instCounts = {};
      allPublications.forEach(pub => {
         const authors = getPublicationAuthors(pub);
         const seen = new Set();
         authors.forEach(slug => {
            const meta = authorMetadata.authors[slug];
            if (!meta) return;
            const affId = meta.affiliation;
            if (affId && !SELF_INSTITUTIONS.includes(affId) && !seen.has(affId)) {
               seen.add(affId);
               instCounts[affId] = (instCounts[affId] || 0) + 1;
            }
         });
      });

      if (Object.keys(instCounts).length === 0) {
         if (elements.collaborationFilterSection) elements.collaborationFilterSection.style.display = 'none';
         return;
      }

      // Sort by count descending
      const sorted = Object.entries(instCounts).sort((a, b) => b[1] - a[1]);

      const container = elements.collaborationTree;
      container.innerHTML = '';

      sorted.forEach(([instId, count]) => {
         const instName = (authorMetadata.institutions && authorMetadata.institutions[instId])
            ? authorMetadata.institutions[instId].name : instId;
         const cbId = 'collab-' + instId;
         const div = document.createElement('div');
         div.className = 'form-check';
         div.innerHTML =
            '<input class="form-check-input" type="checkbox" id="' + cbId + '" data-type="collaboration" value="' + instId + '" checked>' +
            '<label class="form-check-label d-flex justify-content-between align-items-center" for="' + cbId + '">' +
            '<span>' + instName + '</span>' +
            '<span class="pub-count" data-filter-dim="collaboration" data-filter-val="' + instId + '" data-total="' + count + '">' + count + ' / ' + count + '</span>' +
            '</label>';
         container.appendChild(div);
      });

      state.filters.collaborations = sorted.map(([id]) => id);
   }

   function setupCollaborationFilters() {
      if (elements.collaborationMasterCheckbox) {
         elements.collaborationMasterCheckbox.addEventListener('change', () => {
            elements.collaborationMasterCheckbox.indeterminate = false;
            setAllCollaborationCheckboxes(elements.collaborationMasterCheckbox.checked);
            updateCollaborationFilters();
            applyFiltersAndRender();
         });
      }
      if (elements.collaborationTree) {
         elements.collaborationTree.addEventListener('change', (e) => {
            if (e.target.matches('input[data-type="collaboration"]')) {
               updateCollaborationFilters();
               syncCollaborationMasterCheckbox();
               applyFiltersAndRender();
            }
         });
      }
   }

   function setAllCollaborationCheckboxes(checked) {
      if (elements.collaborationTree) {
         elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]').forEach(cb => cb.checked = checked);
      }
   }

   function updateCollaborationFilters() {
      state.filters.collaborations = [];
      if (elements.collaborationTree) {
         elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]').forEach(cb => {
            if (cb.checked) state.filters.collaborations.push(cb.value);
         });
      }
   }

   function syncCollaborationMasterCheckbox() {
      if (!elements.collaborationMasterCheckbox || !elements.collaborationTree) return;
      const all = elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]');
      const checked = elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]:checked');
      if (checked.length === 0) {
         elements.collaborationMasterCheckbox.checked = false;
         elements.collaborationMasterCheckbox.indeterminate = false;
      } else if (checked.length === all.length) {
         elements.collaborationMasterCheckbox.checked = true;
         elements.collaborationMasterCheckbox.indeterminate = false;
      } else {
         elements.collaborationMasterCheckbox.checked = false;
         elements.collaborationMasterCheckbox.indeterminate = true;
      }
   }

   // ============================================================================
   // Author Popovers
   // ============================================================================

   function setupAuthorPopovers() {
      // Delegate click on .pub-author spans
      document.addEventListener('click', (e) => {
         const authorSpan = e.target.closest('.pub-author');
         
         // Close any existing popover if clicking elsewhere
         const existingPopover = document.querySelector('.author-popover');
         if (existingPopover && (!authorSpan || existingPopover.dataset.slug !== (authorSpan && authorSpan.dataset.authorSlug))) {
            existingPopover.remove();
         }
         
         if (!authorSpan) return;
         e.preventDefault();
         e.stopPropagation();

         const slug = authorSpan.dataset.authorSlug;
         if (!slug) return;

         // Toggle if same popover
         const existing = document.querySelector('.author-popover[data-slug="' + slug + '"]');
         if (existing) {
            existing.remove();
            return;
         }

         const meta = authorMetadata && authorMetadata.authors[slug];
         if (!meta) return;

         // Find institution at time of pub
         const pubItem = authorSpan.closest('.publication-item');
         const pubYear = pubItem ? getPublicationYear(pubItem) : null;
         let pubInstitution = null;
         if (pubYear && meta.history) {
            for (const h of meta.history) {
               const match = (h.period || '').match(/(\d{4})\s*[–-]\s*(\d{4}|present)/);
               if (match) {
                  const start = parseInt(match[1]);
                  const end = match[2] === 'present' ? 9999 : parseInt(match[2]);
                  if (pubYear >= start && pubYear <= end) {
                     pubInstitution = h;
                     break;
                  }
               }
            }
         }

         // Build popover content
         const popover = document.createElement('div');
         popover.className = 'author-popover';
         popover.dataset.slug = slug;

         let html = '<div class="author-popover-header"><strong>' + meta.name + '</strong></div>';

         // Current affiliation
         if (meta.affiliationName) {
            html += '<div class="author-popover-info"><i class="bi bi-building"></i> ' + meta.affiliationName + '</div>';
         }

         // Institution at time of publication
         if (pubInstitution && pubInstitution.institutionName !== meta.affiliationName) {
            html += '<div class="author-popover-info text-muted"><i class="bi bi-clock-history"></i> ' +
               pubInstitution.institutionName + ' (' + pubInstitution.period + ')</div>';
         }

         // Links
         html += '<div class="author-popover-links">';
         if (meta.url) {
            html += '<a href="' + meta.url + '" target="_blank" class="btn btn-sm btn-outline-primary" title="Homepage"><i class="bi bi-globe"></i></a>';
         }
         if (meta.scholar) {
            html += '<a href="' + meta.scholar + '" target="_blank" class="btn btn-sm btn-outline-primary" title="Google Scholar"><i class="bi bi-google"></i></a>';
         }
         // Filter button
         html += '<button class="btn btn-sm btn-outline-secondary author-popover-filter" data-filter-slug="' + slug + '" title="Filter publications"><i class="bi bi-funnel"></i></button>';
         html += '</div>';

         popover.innerHTML = html;

         // Position relative to the author span
         const rect = authorSpan.getBoundingClientRect();
         popover.style.position = 'fixed';
         popover.style.left = rect.left + 'px';
         popover.style.top = (rect.bottom + 4) + 'px';
         popover.style.zIndex = '1050';

         document.body.appendChild(popover);

         // Ensure popover stays within viewport
         requestAnimationFrame(() => {
            const popRect = popover.getBoundingClientRect();
            if (popRect.right > window.innerWidth - 8) {
               popover.style.left = (window.innerWidth - popRect.width - 8) + 'px';
            }
            if (popRect.bottom > window.innerHeight - 8) {
               popover.style.top = (rect.top - popRect.height - 4) + 'px';
            }
         });

         // Filter button handler
         popover.querySelector('.author-popover-filter')?.addEventListener('click', () => {
            soloCoauthor(slug);
            popover.remove();
         });
      });
   }

   function soloCoauthor(slug) {
      // Uncheck all coauthors, check only this one
      setAllCoauthorCheckboxes(false);
      const cb = document.getElementById('coauthor-' + slug);
      if (cb) {
         cb.checked = true;
         // Expand the coauthor section if collapsed
         const tree = document.getElementById('coauthor-tree');
         if (tree && !tree.classList.contains('show')) {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(tree, { toggle: false });
            bsCollapse.show();
         }
      }
      updateCoauthorFilters();
      syncCoauthorMasterCheckbox();
      applyFiltersAndRender();
   }

   // ============================================================================
   // Filtering Logic
   // ============================================================================
   
   function getFilteredPublications() {
      return allPublications.filter(item => {
         // Type filter — empty types means all default types are shown
         const itemType = getPublicationType(item);
         const activeTypes = state.filters.types.length > 0 ? state.filters.types : DEFAULT_CHECKED_TYPES;
         const typeMatch = activeTypes.includes(itemType);
         
         // Venue filter
         const itemVenue = getPublicationVenue(item);
         let venueMatch;
         if (state.filters.venues.length === 0) {
            venueMatch = true;
         } else if (itemVenue) {
            venueMatch = state.filters.venues.includes(itemVenue);
         } else {
            venueMatch = !isVenueNarrowingActive(itemType);
         }
         
         // Activity filter — items without projects always pass
         const itemProjects = getPublicationProjects(item);
         const activityMatch = itemProjects.length === 0 ||
                              state.filters.activities.length === 0 ||
                              itemProjects.some(p => state.filters.activities.includes(p));
         
         // Coauthor filter — items without coauthor data always pass
         // When some coauthors are unchecked, only pubs with at least one checked coauthor pass
         const itemAuthors = getPublicationAuthors(item);
         const coauthorNarrowing = isCoauthorNarrowingActive();
         const coauthorMatch = !coauthorNarrowing || itemAuthors.length === 0 ||
                              itemAuthors.some(a => state.filters.coauthors.includes(a));

         // Affiliation filter — year-based self-affiliation (from data attribute)
         const affiliationNarrowing = isAffiliationNarrowingActive();
         let affiliationMatch = true;
         if (affiliationNarrowing) {
            const selfAff = item.dataset.selfAffiliation;
            affiliationMatch = !selfAff || state.filters.affiliations.includes(selfAff);
         }

         // Collaboration filter
         const collaborationNarrowing = isCollaborationNarrowingActive();
         let collaborationMatch = true;
         if (collaborationNarrowing) {
            // Check if any of this pub's coauthor institutions are checked
            const pubCollabs = getPublicationCollaborationInstitutions(item);
            collaborationMatch = pubCollabs.length === 0 ||
                                pubCollabs.some(id => state.filters.collaborations.includes(id));
         }

         // Date filter
         const itemYear = getPublicationYear(item);
         const dateMatch = itemYear >= state.filters.dateRange.start && 
                          itemYear <= state.filters.dateRange.end;
         
         // Award filter
         const awardMatch = !state.filters.awardOnly || hasAward(item);
         const hasCodeMatch = !state.filters.hasCodeOnly || hasCode(item);
         const hasDatasetMatch = !state.filters.hasDatasetOnly || hasDataset(item);
         const reproducibleMatch = !state.filters.reproducibleOnly || isReproducible(item);
         
         return typeMatch && venueMatch && activityMatch && coauthorMatch &&
                affiliationMatch && collaborationMatch && dateMatch && awardMatch &&
                hasCodeMatch && hasDatasetMatch && reproducibleMatch;
      });
   }

   function isCoauthorNarrowingActive() {
      if (!elements.coauthorTree) return false;
      const all = elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]');
      const checked = elements.coauthorTree.querySelectorAll('input[data-type="coauthor"]:checked');
      return all.length > 0 && checked.length < all.length;
   }

   function isAffiliationNarrowingActive() {
      if (!elements.affiliationTree) return false;
      const all = elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]');
      const checked = elements.affiliationTree.querySelectorAll('input[data-type="affiliation"]:checked');
      return all.length > 0 && checked.length < all.length;
   }

   function isCollaborationNarrowingActive() {
      if (!elements.collaborationTree) return false;
      const all = elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]');
      const checked = elements.collaborationTree.querySelectorAll('input[data-type="collaboration"]:checked');
      return all.length > 0 && checked.length < all.length;
   }

   function getPublicationCollaborationInstitutions(item) {
      const authors = getPublicationAuthors(item);
      const instIds = new Set();
      authors.forEach(slug => {
         const meta = authorMetadata && authorMetadata.authors && authorMetadata.authors[slug];
         if (meta && meta.affiliation && !SELF_INSTITUTIONS.includes(meta.affiliation)) {
            instIds.add(meta.affiliation);
         }
      });
      return Array.from(instIds);
   }
   
   function getPublicationType(item) {
      if (item.dataset.publicationType) return item.dataset.publicationType;

      // Check for type indicators in the item
      if (item.classList.contains('type-journal') || item.querySelector('.label-journal')) return 'journal';
      if (item.classList.contains('type-conference') || item.querySelector('.label-conference')) return 'conference';
      if (item.classList.contains('type-workshop') || item.querySelector('.label-workshop')) return 'workshop';
      
      // Check parent section
      const parent = item.closest('div[id]');
      if (parent) {
         const parentId = parent.id || '';
         if (parentId.includes('ietf') || parentId.includes('draft')) return 'ietf';
         if (parentId.includes('patent')) return 'patent';
      }
      
      // Check by section heading
      let currentElement = item.previousElementSibling;
      while (currentElement) {
         if (currentElement.classList.contains('section-heading')) {
            const text = currentElement.textContent.toLowerCase();
            if (text.includes('ietf') || text.includes('draft')) return 'ietf';
            if (text.includes('patent')) return 'patent';
            if (text.includes('poster')) return 'workshop'; // Treat posters as workshops
            break;
         }
         currentElement = currentElement.previousElementSibling;
      }
      
      // Default to conference if has label
      const label = item.querySelector('.label');
      if (label) {
         const labelText = label.textContent.toLowerCase();
         if (labelText.includes('journal') || labelText.includes('j')) return 'journal';
         if (labelText.includes('workshop') || labelText.includes('w')) return 'workshop';
         return 'conference'; // Default for 'C' label
      }
      
      return 'conference'; // Default fallback
   }
   
   function getPublicationVenue(item) {
      return item.dataset.publicationVenue || '';
   }
   
   function getPublicationProjects(item) {
      const raw = item.dataset.publicationProjects;
      if (!raw) return [];
      return raw.split(',').map(s => s.trim()).filter(Boolean);
   }
   
   function getPublicationYear(item) {
      if (item.dataset.publicationYear) {
         return parseInt(item.dataset.publicationYear, 10);
      }

      // Try to find year in the item
      const yearMatch = item.textContent.match(/\b(19|20)\d{2}\b/);
      return yearMatch ? parseInt(yearMatch[0], 10) : yearBounds.max;
   }

   function getYearBounds() {
      const years = allPublications
         .map(getPublicationYear)
         .filter(year => Number.isFinite(year));

      if (!years.length) {
         const currentYear = new Date().getFullYear();
         return { min: currentYear - 10, max: currentYear };
      }

      return {
         min: Math.min(...years),
         max: Math.max(...years)
      };
   }

   function hasAward(item) {
      // Check data attribute
      if (item.dataset.publicationAward === 'true') return true;
      // Check for award line inside btex items
      if (item.querySelector('.publication-award-line')) return true;
      // Check type
      if (getPublicationType(item) === 'award') return true;
      return false;
   }

   function hasCode(item) {
      // Has a code artifact (GitHub button specifically, not arXiv/dataset)
      return !!item.querySelector('.btn-artifact .fa-github');
   }

   function hasDataset(item) {
      return !!item.querySelector('.btn-artifact .fa-database');
   }

   function isReproducible(item) {
      // Reproducible = has code (GitHub) OR dataset artifact
      return !!item.querySelector('.btn-artifact .fa-github, .btn-artifact .fa-database');
   }
   
   // ============================================================================
   // Rendering
   // ============================================================================
   
   function applyFiltersAndRender() {
      const filteredPubs = getFilteredPublications();
      
      console.log(`📊 Filtering: ${filteredPubs.length}/${allPublications.length} publications visible`);
      
      // Show/hide publications
      allPublications.forEach(pub => {
         if (filteredPubs.includes(pub)) {
            pub.style.display = '';
         } else {
            pub.style.display = 'none';
         }
      });
      
      // Hide/show section headings based on visible items
      updateListVisibility();
      updateSectionVisibility();
      
      // Update stats
      updateStats(filteredPubs);
         // Update badge counts with filtered/total format
         updateBadgeCounts(filteredPubs);
      
      
      // Keep state in-memory only (no browser persistence)
      saveState();
   }
   
   function updateSectionVisibility() {
      const sections = document.querySelectorAll('.section-heading');
      sections.forEach(section => {
         // Check if next siblings until next section have any visible items
         let hasVisibleItems = false;
         let nextElement = section.nextElementSibling;
         
         while (nextElement && !nextElement.classList.contains('section-heading')) {
            if (nextElement.classList.contains('publication-item') && nextElement.style.display !== 'none') {
               hasVisibleItems = true;
               break;
            }
            if (nextElement.classList.contains('publications-list')) {
               const visibleListItem = Array.from(nextElement.querySelectorAll('li')).some(item => item.style.display !== 'none');
               if (visibleListItem) {
                  hasVisibleItems = true;
                  break;
               }
            }
            nextElement = nextElement.nextElementSibling;
         }
         
         section.style.display = hasVisibleItems ? '' : 'none';
      });
   }

   function updateListVisibility() {
      document.querySelectorAll('.publications-list').forEach(list => {
         const trackedItems = Array.from(list.querySelectorAll('li[data-publication-type]'));
         if (!trackedItems.length) {
            return;
         }
         const visibleItems = trackedItems.some(item => item.style.display !== 'none');
         list.style.display = visibleItems ? '' : 'none';
      });
   }
   
   function updateStats(filteredPubs) {
      // Update count
      if (elements.totalPubsDisplay) {
         elements.totalPubsDisplay.textContent = filteredPubs.length;
      }
      
      // Calculate citations from filtered pubs
      let filteredCitations = 0;
      filteredPubs.forEach(pub => {
         const citeBadge = pub.querySelector('.publication-cite-badge');
         if (citeBadge) {
            const citeMatch = citeBadge.textContent.match(/(\d+)\s+cite/);
            if (citeMatch) {
               filteredCitations += parseInt(citeMatch[1]);
            }
         }
      });
      
      if (elements.totalCitesDisplay) {
         elements.totalCitesDisplay.textContent = filteredCitations;
      }
   }
   
   function calculateStats() {
      // Calculate initial total citations and h-index
      const citations = [];
      
      allPublications.forEach(pub => {
         const citeBadge = pub.querySelector('.publication-cite-badge');
         if (citeBadge) {
            const citeMatch = citeBadge.textContent.match(/(\d+)\s+cite/);
            if (citeMatch) {
               const count = parseInt(citeMatch[1]);
               citations.push(count);
               totalCitations += count;
            }
         }
      });
      
      // Calculate h-index
      citations.sort((a, b) => b - a);
      for (let i = 0; i < citations.length; i++) {
         if (citations[i] < i + 1) {
            hIndex = i;
            break;
         }
         hIndex = i + 1;
      }
      
      // Update displays (will be overwritten by filtered stats initially)
      if (elements.totalPubsDisplay) elements.totalPubsDisplay.textContent = allPublications.length;
      if (elements.totalCitesDisplay) elements.totalCitesDisplay.textContent = totalCitations;
      if (elements.hIndexDisplay) elements.hIndexDisplay.textContent = hIndex;
      
      console.log(`📊 Total: ${allPublications.length} pubs, ${totalCitations} citations, h-index: ${hIndex}`);
   }
   
   // ============================================================================
   // BibTeX Copy-to-Clipboard

      function updateBadgeCounts(filteredPubs) {
         // Unified handler for all .pub-count badges with data-filter-dim
         document.querySelectorAll('.publications-sidebar .pub-count[data-filter-dim]').forEach(function(badge) {
            var dim = badge.getAttribute('data-filter-dim');
            var val = badge.getAttribute('data-filter-val');
            var total = parseInt(badge.getAttribute('data-total'), 10);
            var filteredCount;

            if (dim === 'pubtype') {
               filteredCount = filteredPubs.filter(function(p) { return getPublicationType(p) === val; }).length;
            } else if (dim === 'venue') {
               filteredCount = filteredPubs.filter(function(p) { return p.getAttribute('data-publication-venue') === val; }).length;
            } else if (dim === 'activity') {
               filteredCount = filteredPubs.filter(function(p) { return getPublicationProjects(p).indexOf(val) !== -1; }).length;
            } else if (dim === 'actgroup') {
               var groupEl = document.querySelector('.activity-subs[data-group="' + val + '"]');
               var groupActs = groupEl ? Array.from(groupEl.querySelectorAll('input[data-type="activity"]')).map(function(cb) { return cb.value; }) : [];
               filteredCount = filteredPubs.filter(function(p) { var projs = getPublicationProjects(p); return projs.some(function(proj) { return groupActs.indexOf(proj) !== -1; }); }).length;
            } else if (dim === 'actsuper') {
               var superEl = document.querySelector('.activity-groups[data-super="' + val + '"]');
               var superActs = superEl ? Array.from(superEl.querySelectorAll('input[data-type="activity"]')).map(function(cb) { return cb.value; }) : [];
               filteredCount = filteredPubs.filter(function(p) { var projs = getPublicationProjects(p); return projs.some(function(proj) { return superActs.indexOf(proj) !== -1; }); }).length;
            } else if (dim === 'coauthor') {
               filteredCount = filteredPubs.filter(function(p) { return getPublicationAuthors(p).indexOf(val) !== -1; }).length;
            } else if (dim === 'affiliation') {
               filteredCount = filteredPubs.filter(function(p) { return p.dataset.selfAffiliation === val; }).length;
            } else if (dim === 'collaboration') {
               filteredCount = filteredPubs.filter(function(p) { return getPublicationCollaborationInstitutions(p).indexOf(val) !== -1; }).length;
            }

            if (filteredCount !== undefined) {
               badge.textContent = filteredCount + ' / ' + total;
               badge.title = filteredCount + ' of ' + total + ' publications';
            }
         });
      }
   // ============================================================================

   function initCopyButtons() {
      document.querySelectorAll('.publication-copy-bib').forEach(function(btn) {
         btn.addEventListener('click', function() {
            var targetId = this.getAttribute('data-bibtex-target');
            var pre = document.getElementById(targetId);
            if (!pre) return;
            var text = pre.textContent || pre.innerText;
            navigator.clipboard.writeText(text).then(function() {
               var orig = btn.innerHTML;
               btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
               btn.classList.add('btn-copied');
               setTimeout(function() {
                  btn.innerHTML = orig;
                  btn.classList.remove('btn-copied');
               }, 2000);
            });
         });
      });
   }

   // ============================================================================
   // Initialize on DOM Ready
   // ============================================================================
   
   if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { init(); initCopyButtons(); });
   } else {
      init();
      initCopyButtons();
   }
   
})();
