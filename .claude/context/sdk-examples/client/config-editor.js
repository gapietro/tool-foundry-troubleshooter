// Stub: client-side script for the ui-page Example 3 (config editor).
// Replace with the actual editor logic when adapting to a real project —
// this file just satisfies the Now.include() reference at build time so
// the example compiles.
(function() {
  var textarea = document.querySelector('textarea[name="sysparm_config_json"]');
  if (textarea) {
    textarea.addEventListener('blur', function() {
      try {
        JSON.parse(textarea.value);
      } catch (e) {
        alert('Config JSON is invalid: ' + e.message);
      }
    });
  }
})();
