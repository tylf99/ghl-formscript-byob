<script>
(function () {

  // ============================================
  // CONFIG — Update field IDs here only
  // ============================================
  var FIELD_IDS = {
    ip:          'FgVQtyrfohBaflQGEJAg',
    city:        'wQYeCcQP7VjJ41Swjzzv',
    state:       'c4lvfQ5bw2Ap3j5fvKq7',
    country:     'eQst1dAYbzydmHB7N6IP',
    uuid:        'dvQuFqkpkX2zgUipriHK',
    pagePath:    'SBKaDYEdgvHN4MUUd2iC',
    utm_source:  'contact.utm_source',
    utm_medium:  'utm_medium',
    utm_campaign:'utm_campaign',
    utm_content: 'utm_content',
    utm_term:    'utm_term',
    utm_id:      'utm_id',
    fbp:         'YOUR_FBP_FIELD_ID',
    fbc:         'YOUR_FBC_FIELD_ID',
    userAgent:   'YOUR_USER_AGENT_FIELD_ID'
  };

  // ============================================
  // UTILITY: Set value on GHL hidden field
  // ============================================
  function setValue(fieldId, value) {
    var field = document.getElementById(fieldId);
    if (!field || !value) return;
    field.value = value;
    field.setAttribute('value', value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ============================================
  // UTILITY: Generate UUID — GHL-safe
  // ============================================
  function generateUUID() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    var arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    var uuid = '';
    for (var i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) uuid += '-';
      var hex = arr[i].toString(16);
      if (hex.length < 2) hex = '0' + hex;
      uuid += hex;
    }
    return uuid;
  }

  // ============================================
  // UTILITY: Retry wrapper
  // ============================================
  function retry(fn, maxAttempts, interval) {
    maxAttempts = maxAttempts || 10;
    interval = interval || 500;
    var attempt = 0;
    function run() {
      var done = fn(attempt);
      if (!done && attempt < maxAttempts) {
        attempt++;
        setTimeout(run, interval);
      }
    }
    run();
  }

  // ============================================
  // MODULE 1: UUID
  // ============================================
  function initUUID() {
    retry(function (attempt) {
      var field = document.getElementById(FIELD_IDS.uuid);
      if (!field) return false;
      var uuid = generateUUID();
      setValue(FIELD_IDS.uuid, uuid);
      localStorage.setItem('fb_event_id', uuid);
      localStorage.setItem('fb_external_id', uuid);
      console.log('[UUID] Set:', uuid);
      return true;
    });
  }

  // ============================================
  // MODULE 2: IP + Location
  // ============================================
  function initIPLocation() {
    var sources = [
      'https://ipinfo.io/json?token=e598dfee51af1c',
      'https://api.db-ip.com/v2/free/self',
      'https://ipwho.is/'
    ];

    function trySource(i) {
      if (i >= sources.length) {
        console.warn('[IP] All sources failed');
        return;
      }
      fetch(sources[i])
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var ip      = data.ip || data.ipAddress || '';
          var city    = data.city || '';
          var state   = data.region || data.stateProv || '';
          var country = data.country || data.countryCode || '';

          setValue(FIELD_IDS.ip,      ip);
          setValue(FIELD_IDS.city,    city);
          setValue(FIELD_IDS.state,   state);
          setValue(FIELD_IDS.country, country);

          localStorage.setItem('fb_ip', ip);
          console.log('[IP] Captured:', ip, city, state, country);
        })
        .catch(function (err) {
          console.warn('[IP] Source failed, trying next:', err);
          trySource(i + 1);
        });
    }

    trySource(0);
  }

  // ============================================
  // MODULE 3: Page Path
  // ============================================
  function initPagePath() {
    retry(function (attempt) {
      var field = document.getElementById(FIELD_IDS.pagePath);
      if (!field) return false;

      var path = (window.parent !== window)
        ? window.parent.location.pathname
        : window.location.pathname;

      setValue(FIELD_IDS.pagePath, path);
      console.log('[PagePath] Captured:', path);
      return true;
    });
  }

  // ============================================
  // MODULE 4: UTM Parameters
  // ============================================
  function initUTMs() {
    retry(function (attempt) {
      var search = (window.parent !== window)
        ? window.parent.location.search
        : window.location.search;
      var params = new URLSearchParams(search);

      var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
      var allFound = true;

      for (var k = 0; k < utmKeys.length; k++) {
        var key = utmKeys[k];
        var fieldId = FIELD_IDS[key];
        var field = document.getElementById(fieldId);
        if (field) {
          setValue(fieldId, params.get(key));
        } else {
          allFound = false;
        }
      }

      if (allFound) {
        console.log('[UTMs] All fields mapped');
        return true;
      }
      return false;
    });
  }

  // ============================================
  // MODULE 5: FBP + FBC + User Agent
  // Reads fbp from pixel JS object only
  // Builds fbc from fbclid URL param only
  // ============================================
  function initFBParams() {
    retry(function (attempt) {
      var search = (window.parent !== window)
        ? window.parent.location.search
        : window.location.search;
      var fbclid = new URLSearchParams(search).get('fbclid');
      var fbc = fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : null;

      var fbp = null;
      try {
        if (
          window.fbq &&
          window.fbq.instance &&
          window.fbq.instance.pixelsByID
        ) {
          var ids = Object.keys(window.fbq.instance.pixelsByID);
          if (ids.length > 0) {
            var pd = window.fbq.instance.pixelsByID[ids[0]];
            if (pd && pd.browserData && pd.browserData.pixelID) {
              fbp = pd.browserData.pixelID;
            }
          }
        }
      } catch (e) {
        console.warn('[FBParams] Could not read fbp from pixel object');
      }

      var userAgent = navigator.userAgent;

      if (fbp) {
        localStorage.setItem('fb_fbp', fbp);
        setValue(FIELD_IDS.fbp, fbp);
      }
      if (fbc) {
        localStorage.setItem('fb_fbc', fbc);
        setValue(FIELD_IDS.fbc, fbc);
      }
      localStorage.setItem('fb_user_agent', userAgent);
      setValue(FIELD_IDS.userAgent, userAgent);

      console.log('[FBParams] fbp:', fbp, '| fbc:', fbc);
      return !!fbp;
    });
  }

  // ============================================
  // MODULE 6: Form Submit Snapshot
  // Re-captures all values at submit time
  // ============================================
  function initFormSubmitListener() {
    retry(function (attempt) {
      var form = document.querySelector('form');
      if (!form) return false;

      form.addEventListener('submit', function () {
        var uuidEl      = document.getElementById(FIELD_IDS.uuid);
        var ipEl        = document.getElementById(FIELD_IDS.ip);
        var fbpEl       = document.getElementById(FIELD_IDS.fbp);
        var fbcEl       = document.getElementById(FIELD_IDS.fbc);

        var uuid      = uuidEl      ? uuidEl.value      : '';
        var ip        = ipEl        ? ipEl.value        : '';
        var fbp       = fbpEl       ? fbpEl.value       : '';
        var fbc       = fbcEl       ? fbcEl.value       : '';
        var userAgent = navigator.userAgent;

        if (uuid)      localStorage.setItem('fb_event_id',    uuid);
        if (uuid)      localStorage.setItem('fb_external_id', uuid);
        if (ip)        localStorage.setItem('fb_ip',          ip);
        if (fbp)       localStorage.setItem('fb_fbp',         fbp);
        if (fbc)       localStorage.setItem('fb_fbc',         fbc);
        if (userAgent) localStorage.setItem('fb_user_agent',  userAgent);

        console.log('[FormSubmit] Snapshot saved to storage');
      });

      console.log('[FormSubmit] Submit listener attached');
      return true;
    });
  }

  // ============================================
  // INIT
  // ============================================
  function init() {
    initUUID();
    initIPLocation();
    initPagePath();
    initUTMs();
    initFBParams();
    initFormSubmitListener();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
</script>
