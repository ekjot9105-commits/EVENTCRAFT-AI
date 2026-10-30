// Shows a recoverable message if the app bundle fails to load. Kept as an external
// file (not inline) so it runs under the production Content-Security-Policy.
window.addEventListener('error', function () {
  var loader = document.getElementById('initial-loader');
  if (!loader || loader.dataset.failed) return;
  loader.dataset.failed = 'true';
  loader.setAttribute('role', 'alert');
  loader.innerHTML =
    '<div class="boot-error-card">' +
    '<div class="boot-error-icon" aria-hidden="true">!</div>' +
    '<h1 class="boot-error-title">Loading error</h1>' +
    '<p class="boot-error-text">The app could not finish loading. Check your connection and reload the page.</p>' +
    '<button type="button" class="boot-error-button">Reload page</button>' +
    '</div>';
  loader.querySelector('button').addEventListener('click', function () {
    window.location.reload();
  });
});
