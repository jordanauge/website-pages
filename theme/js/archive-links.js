/**
 * Archive Links — site-wide hover badge for archived external URLs.
 *
 * Fetches /static/archive-map.json (URL → archive path), then decorates
 * every <a href> whose URL has an archived version with a small archive
 * icon that appears on hover, positioned to the right of the link so it
 * does not disrupt normal clicking.
 */
(function () {
  'use strict';

  // Skip if no fetch support (very old browsers)
  if (typeof fetch !== 'function') return;

  /** Normalize a URL for map lookup (strip trailing slash, fragment, scheme variations). */
  function normalizeUrl(url) {
    try {
      var u = new URL(url, window.location.origin);
      // Only decorate external links
      if (u.hostname === window.location.hostname) return null;
      return u.origin + u.pathname.replace(/\/+$/, '') + u.search;
    } catch (e) {
      return null;
    }
  }

  /** Create the hover badge element. */
  function createBadge(archivePath) {
    var badge = document.createElement('a');
    badge.href = archivePath;
    badge.className = 'archive-hover-badge';
    badge.title = 'View archived version';
    badge.setAttribute('aria-label', 'Archived version');
    badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">' +
      '<path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1V2zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5H2zm13-3H1v2h14V2zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>' +
      '</svg>';
    return badge;
  }

  function decorateLinks(archiveMap) {
    // Build a lookup from the map (also try with trailing slash)
    var lookup = {};
    for (var url in archiveMap) {
      if (archiveMap.hasOwnProperty(url)) {
        lookup[url] = archiveMap[url];
        lookup[url + '/'] = archiveMap[url];
      }
    }

    // Select all external links in content areas (skip nav, footer, publication dropdowns)
    var contentAreas = document.querySelectorAll(
      'article, .page-content, .entry-content, main, [role="main"]'
    );
    if (contentAreas.length === 0) {
      contentAreas = [document.body];
    }

    contentAreas.forEach(function (area) {
      var links = area.querySelectorAll('a[href]');
      links.forEach(function (link) {
        // Skip links already decorated, dropdown items, and publication buttons
        if (link.classList.contains('archive-hover-badge') ||
            link.classList.contains('dropdown-item') ||
            link.classList.contains('btn-mirror') ||
            link.classList.contains('dropdown-mirror-badge') ||
            link.closest('.publication-sources-menu') ||
            link.closest('.publication-artifact-group') ||
            link.closest('.publication-pdf-group')) {
          return;
        }

        var normalized = normalizeUrl(link.href);
        if (!normalized) return;

        var archivePath = lookup[normalized];
        if (!archivePath) return;

        // Wrap the link in a container for positioning
        var wrapper = document.createElement('span');
        wrapper.className = 'archive-link-wrapper';
        link.parentNode.insertBefore(wrapper, link);
        wrapper.appendChild(link);
        wrapper.appendChild(createBadge(archivePath));
      });
    });
  }

  // Load archive map and decorate links after DOM is ready
  function init() {
    fetch('/static/archive-map.json')
      .then(function (resp) {
        if (!resp.ok) throw new Error('archive-map.json not found');
        return resp.json();
      })
      .then(decorateLinks)
      .catch(function () {
        // Silently ignore if archive map is not available
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
