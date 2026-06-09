// transport.js — environment detection
// Must load BEFORE all other scripts. Sets window.IS_DEMO and window.HOST_ENV.
// Function overrides (loadDevices, loadServices, etc.) are applied by
// transport-mocks.js which loads AFTER all other scripts.

(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  window.IS_DEMO = window.location.hostname.includes('github.io')
    || params.get('demo') === '1';
  window.HOST_ENV = window.IS_DEMO ? 'demo' : 'local';
})();
