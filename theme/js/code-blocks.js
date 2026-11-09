(function () {
  'use strict';

  function addCopyButtons() {
    document.querySelectorAll('div.highlight').forEach(function (block) {
      // Avoid duplicates (e.g. nested highlight divs from linenums table)
      if (block.querySelector('.copy-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.innerHTML = '<i class="bi bi-clipboard" aria-hidden="true"></i>';

      block.appendChild(btn);

      btn.addEventListener('click', function () {
        // When linenums are on, codehilite wraps in a table; grab only the code cell
        var codeEl = block.querySelector('td.code pre') || block.querySelector('pre');
        if (!codeEl) return;

        navigator.clipboard.writeText(codeEl.innerText).then(function () {
          btn.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i>';
          btn.classList.add('copy-btn--copied');
          setTimeout(function () {
            btn.innerHTML = '<i class="bi bi-clipboard" aria-hidden="true"></i>';
            btn.classList.remove('copy-btn--copied');
          }, 2000);
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButtons);
  } else {
    addCopyButtons();
  }
})();
