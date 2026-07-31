// Stub: Client-side onLoad script for the client-script golden example.
// Replace with the actual form-load behavior when adapting to a real project —
// this file just satisfies the Now.include() reference at build time so the
// example compiles.
function onLoad() {
  if (typeof g_form === 'undefined') return;
  if (g_form.getValue('state') === '0') {
    g_form.addInfoMessage('New change request — fill in all required fields.');
  }
}
