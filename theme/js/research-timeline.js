(function() {
  'use strict';

  function splitList(value) {
    if (!value) {
      return [];
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  function checkedValues(nodeList) {
    return Array.from(nodeList)
      .filter((node) => node.checked)
      .map((node) => node.value);
  }

  function setCheckedValues(nodeList, values) {
    const allowed = new Set(values);
    Array.from(nodeList).forEach((node) => {
      node.checked = allowed.has(node.value);
    });
  }

  function allValues(nodeList) {
    return Array.from(nodeList).map((node) => node.value);
  }

  function arraysEqualAsSet(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    const bSet = new Set(b);
    return a.every((item) => bSet.has(item));
  }

  document.addEventListener('DOMContentLoaded', function() {
    const root = document.querySelector('[data-research-timeline]');
    if (!root) {
      return;
    }

    const summary = document.getElementById('timeline-results-summary');
    const emptyState = document.getElementById('timeline-empty-state');
    const entries = Array.from(root.querySelectorAll('[data-timeline-entry]'));
    const topicCheckboxes = Array.from(document.querySelectorAll('input[data-filter-type="topic"]'));
    const typeCheckboxes = Array.from(document.querySelectorAll('input[data-filter-type="event-type"]'));
    const viewRadios = Array.from(document.querySelectorAll('input[name="timeline-view"]'));
    const resetButton = document.getElementById('timeline-reset-filters');

    const state = {
      topics: checkedValues(topicCheckboxes),
      types: checkedValues(typeCheckboxes),
      scope: root.dataset.defaultScope || 'all',
      view: 'timeline'
    };

    function syncView() {
      root.classList.toggle('timeline-view-cards', state.view === 'cards');
      viewRadios.forEach((radio) => {
        radio.checked = radio.value === state.view;
      });
    }

    function syncUrl() {
      const allTopicValues = allValues(topicCheckboxes);
      const allTypeValues = allValues(typeCheckboxes);
      const hashParams = new URLSearchParams();

      if (!arraysEqualAsSet(state.topics, allTopicValues)) {
        hashParams.set('topics', state.topics.join(','));
      }
      if (!arraysEqualAsSet(state.types, allTypeValues)) {
        hashParams.set('types', state.types.join(','));
      }
      if (state.scope !== 'all') {
        hashParams.set('scope', state.scope);
      }
      if (state.view !== 'timeline') {
        hashParams.set('view', state.view);
      }

      const hash = hashParams.toString();
      const nextUrl = `${window.location.pathname}${hash ? `#${hash}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }

    function applyHashFilters() {
      const queryParams = new URLSearchParams(window.location.search);
      const hashRaw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hashRaw);

      const oldTopic = hashParams.get('topic') || queryParams.get('topic');
      const oldType = hashParams.get('type') || queryParams.get('type');
      const topicsParam = hashParams.get('topics') || queryParams.get('topics');
      const typesParam = hashParams.get('types') || queryParams.get('types');
      const scopeParam = hashParams.get('scope') || queryParams.get('scope');
      const viewParam = hashParams.get('view') || queryParams.get('view');

      const allowedTopics = new Set(allValues(topicCheckboxes));
      const allowedTypes = new Set(allValues(typeCheckboxes));

      if (oldTopic && allowedTopics.has(oldTopic)) {
        state.topics = [oldTopic];
      } else if (topicsParam) {
        const parsedTopics = splitList(topicsParam).filter((topic) => allowedTopics.has(topic));
        if (parsedTopics.length > 0) {
          state.topics = parsedTopics;
        }
      }

      if (oldType && allowedTypes.has(oldType)) {
        state.types = [oldType];
      } else if (typesParam) {
        const parsedTypes = splitList(typesParam).filter((type) => allowedTypes.has(type));
        if (parsedTypes.length > 0) {
          state.types = parsedTypes;
        }
      }

      if (scopeParam) {
        state.scope = scopeParam;
      }

      if (viewParam === 'cards' || viewParam === 'timeline') {
        state.view = viewParam;
      }

      setCheckedValues(topicCheckboxes, state.topics);
      setCheckedValues(typeCheckboxes, state.types);
      syncView();
    }

    function topicMatchesEntry(entryTopics) {
      const allTopicValues = allValues(topicCheckboxes);
      if (arraysEqualAsSet(state.topics, allTopicValues)) {
        return true;
      }
      if (state.topics.length === 0) {
        return false;
      }
      return state.topics.some((topic) => entryTopics.includes(topic));
    }

    function render() {
      let visibleTracks = 0;
      let visibleEvents = 0;

      entries.forEach((entry) => {
        const kind = entry.dataset.kind;
        const itemTopics = splitList(entry.dataset.topics);
        const itemScope = entry.dataset.scope || 'general';
        const topicMatches = topicMatchesEntry(itemTopics);
        const typeMatches = kind === 'track' || state.types.includes(entry.dataset.type);
        const scopeMatches = state.scope === 'all' || itemScope === state.scope;
        const visible = topicMatches && typeMatches && scopeMatches;

        entry.classList.toggle('timeline-is-hidden', !visible);

        if (visible) {
          if (kind === 'track') {
            visibleTracks += 1;
          } else {
            visibleEvents += 1;
          }
        }
      });

      if (summary) {
        const template = root.dataset.summaryTemplate || '__tracks__ tracks and __events__ public milestones shown.';
        summary.textContent = template
          .replace('__tracks__', String(visibleTracks))
          .replace('__events__', String(visibleEvents));
      }

      if (emptyState) {
        emptyState.style.display = visibleTracks === 0 && visibleEvents === 0 ? 'block' : 'none';
      }

      syncView();
      syncUrl();
    }

    topicCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', function() {
        state.topics = checkedValues(topicCheckboxes);
        render();
      });
    });

    typeCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', function() {
        state.types = checkedValues(typeCheckboxes);
        render();
      });
    });

    viewRadios.forEach((radio) => {
      radio.addEventListener('change', function() {
        if (radio.checked) {
          state.view = radio.value;
          render();
        }
      });
    });

    if (resetButton) {
      resetButton.addEventListener('click', function() {
        const allTopicValues = allValues(topicCheckboxes);
        const allTypeValues = allValues(typeCheckboxes);
        state.topics = allTopicValues;
        state.types = allTypeValues;
        state.scope = root.dataset.defaultScope || 'all';
        state.view = 'timeline';
        setCheckedValues(topicCheckboxes, allTopicValues);
        setCheckedValues(typeCheckboxes, allTypeValues);
        syncView();
        render();
      });
    }

    applyHashFilters();

    window.addEventListener('hashchange', function() {
      applyHashFilters();
      render();
    });

    render();
  });
})();