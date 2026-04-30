/* ════════════════════════════════════════════════════════════════
   FIXES — bug fixes and small UI improvements
   - Stream filter: SSS science user shouldn't see Arts subjects
   - "My progress" routes to the actual progress page (pg-guidance),
     not the level-picker (pg-beta)
   - Arena cloud-game modal needs an exit button
   - Demo banner at top when ?demo=1 is set
   - Hide certain landing-page features unless signed in
   ════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

// ────────────────────────────────────────────────────────────────
// 1. Stream filter — SSS subjects must match the chosen stream
// ────────────────────────────────────────────────────────────────
function patchStreamFilter(){
  // Original buildSidebar/buildWelcomeScreen render ALL subjects for SSS
  // when stream === 'science' (because they only use the suffixed class
  // for non-science streams). Plus, we can't easily re-read the data
  // because subjectsByClass is declared with `const` at script scope —
  // it's NOT on `window`. Solution: filter the rendered DOM after the
  // original runs, by checking the subject prefix on each item.
  var ALWAYS_CORE = ['eng', 'mth', 'civ'];
  var STREAM_SUBJECTS = {
    science:    ['bio','chm','phy','fmth','agr','cmp','dat','geo','eco'],
    arts:       ['lit','gov','his','crs','fre','ara','fne','mus','eco','geo'],
    commercial: ['acc','com','eco','biz','off','ins','cmp','geo'],
    technical:  ['tdr','bld','auto','wdw','elc','mec','agr','cmp']
  };

  function allowedSet(stream){
    var s = STREAM_SUBJECTS[stream] || STREAM_SUBJECTS.science;
    return ALWAYS_CORE.concat(s);
  }
  function subjectPrefix(item){
    // Items have data-subj or extract from onclick="loadSubjectAndClose('eng-s2', ...)"
    var p = item.getAttribute('data-subj');
    if (p) return p;
    var oc = item.getAttribute('onclick') || '';
    var m = oc.match(/loadSubjectAndClose\(['"]([a-z]+)/);
    return m ? m[1] : '';
  }

  function filterSidebarDom(){
    if (window.chosenSection !== 'sss') return;
    var stream = window.chosenStream || 'science';
    var allowed = allowedSet(stream);
    var sidebar = document.getElementById('sbSubjects');
    if (!sidebar) return;
    sidebar.querySelectorAll('.sb-item').forEach(function(item){
      var p = subjectPrefix(item);
      if (!p) return;
      item.style.display = (allowed.indexOf(p) !== -1) ? '' : 'none';
    });
    // Hide group header "Arts/Science Subjects" if all items in it are hidden
    sidebar.querySelectorAll('.term-hdr').forEach(function(h){
      // Walk siblings that are sb-items until next term-hdr
      var seen = 0, visible = 0;
      var n = h.nextElementSibling;
      while (n && !n.classList.contains('term-hdr')){
        if (n.classList.contains('sb-item')){
          seen++;
          if (n.style.display !== 'none') visible++;
        }
        n = n.nextElementSibling;
      }
      h.style.display = (seen > 0 && visible === 0) ? 'none' : '';
    });
  }

  function filterWelcomeGrid(){
    if (window.chosenSection !== 'sss') return;
    var stream = window.chosenStream || 'science';
    var allowed = allowedSet(stream);
    var grid = document.getElementById('wcSubjGrid');
    if (!grid) return;
    grid.querySelectorAll('.wc-subj-btn').forEach(function(btn){
      var oc = btn.getAttribute('onclick') || '';
      var m = oc.match(/startFromWelcome\(['"]([a-z]+)/);
      var prefix = m ? m[1] : '';
      btn.style.display = (allowed.indexOf(prefix) !== -1) ? '' : 'none';
    });
  }

  // Wrap buildSidebar to filter after each render
  var origBuildSb = window.buildSidebar;
  if (typeof origBuildSb === 'function'){
    window.buildSidebar = function(){
      var r = origBuildSb.apply(this, arguments);
      try {
        // Mark as no-translate so the language layer doesn't disturb it
        var sb = document.getElementById('sbSubjects');
        if (sb) sb.setAttribute('data-no-translate-attrs','1');
        filterSidebarDom();
      } catch(e){ console.warn('[stream-filter sb]', e); }
      return r;
    };
  }

  // Wrap buildWelcomeScreen to filter the grid after each render
  var origBuildWS = window.buildWelcomeScreen;
  if (typeof origBuildWS === 'function'){
    window.buildWelcomeScreen = function(){
      var r = origBuildWS.apply(this, arguments);
      try { filterWelcomeGrid(); } catch(e){ console.warn('[stream-filter ws]', e); }
      return r;
    };
  }

  // Re-run filter on stream change (in case user changes their stream)
  window.addEventListener('lt-cloud-hydrated', function(){
    setTimeout(function(){ filterSidebarDom(); filterWelcomeGrid(); }, 200);
  });
}

// ────────────────────────────────────────────────────────────────
// 2. "My progress" account-menu button — route to real progress page
// ────────────────────────────────────────────────────────────────
function patchMyProgressRouting(){
  // We patch by finding the global click handler on the menu button.
  // Because auth-ui-0.js builds the menu on demand, we can't patch
  // the click directly. Instead, intercept goTo('pg-beta') calls
  // when they originate from a signed-in user clicking "My progress".
  // Simpler: intercept the menu rendering by watching the DOM.
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('[data-act="dashboard"]');
    if (!btn) return;
    // We need to override what happens after auth-ui's handler runs.
    // The simplest path: schedule a goTo override after the click.
    setTimeout(function(){
      if (!window.LTAuth || !window.LTAuth.isSignedIn()) return;
      var role = window._LT_LAST_PROFILE && window._LT_LAST_PROFILE.role;
      if (role === 'student'){
        // Route to guidance (which shows the learning report)
        if (typeof window.goTo === 'function') window.goTo('pg-guidance');
      }
      // Parent role is already handled correctly by auth-ui
    }, 30);
  }, true); // capture phase so we run after auth-ui's handler
}

// ────────────────────────────────────────────────────────────────
// 3. Arena cloud-game modal — add exit button
// ────────────────────────────────────────────────────────────────
function patchArenaGameClose(){
  // Watch for the cloud game modal being created and inject a close button.
  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if (!(node instanceof HTMLElement)) return;
        if (node.id === 'arCloudGame' || node.querySelector && node.querySelector('#arCloudGame')){
          var modal = node.id === 'arCloudGame' ? node : node.querySelector('#arCloudGame');
          if (!modal || modal.querySelector('.arcg-close')) return;
          var closeBtn = document.createElement('button');
          closeBtn.className = 'arcg-close';
          closeBtn.style.cssText = 'position:absolute;top:14px;right:14px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);width:36px;height:36px;border-radius:50%;font-size:1.1rem;font-weight:700;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;';
          closeBtn.innerHTML = '✕';
          closeBtn.title = 'Leave game';
          closeBtn.onclick = function(){
            if (!confirm('Leave this game? Your score will not be saved.')) return;
            modal.remove();
          };
          // Make sure the inner card is positioned for the absolute btn
          var card = modal.querySelector('.ar-lobby-card');
          if (card){
            card.style.position = 'relative';
            card.appendChild(closeBtn);
          } else {
            modal.style.position = 'relative';
            modal.appendChild(closeBtn);
          }
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ────────────────────────────────────────────────────────────────
// 4. Demo banner at top
// ────────────────────────────────────────────────────────────────
function injectDemoBanner(){
  if (typeof window.LTIsDemo !== 'function' || !window.LTIsDemo()) return;
  if (document.getElementById('lt-demo-banner')) return;

  var banner = document.createElement('div');
  banner.id = 'lt-demo-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'z-index:2147483645',
    'padding:8px 14px',
    'background:linear-gradient(90deg,#7c3aed,#3b82f6,#10b981)',
    'background-size:200% 100%',
    'animation:ltDemoSlide 6s linear infinite',
    'color:#fff',
    'text-align:center',
    'font-size:.82rem',
    'font-weight:700',
    'font-family:"Plus Jakarta Sans",system-ui,sans-serif',
    'box-shadow:0 2px 14px rgba(0,0,0,.4)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:12px',
    'flex-wrap:wrap'
  ].join(';');
  banner.innerHTML =
    '<span>🎮 DEMO MODE — All features unlocked, role gating disabled.</span>' +
    '<button id="lt-demo-exit" style="background:rgba(255,255,255,.2);color:#fff;border:0;padding:4px 12px;border-radius:100px;font-weight:700;font-size:.78rem;cursor:pointer;font-family:inherit;">Exit demo</button>';

  // Add a tiny shift to the body so content isn't covered
  var pushStyle = document.createElement('style');
  pushStyle.id = 'lt-demo-banner-push';
  pushStyle.textContent =
    '@keyframes ltDemoSlide{0%{background-position:0% 0%}100%{background-position:200% 0%}}' +
    'body{padding-top:calc(38px + 36px) !important;}' +  // 38px existing + 36px banner
    '.l-nav{top:36px !important;}';
  document.head.appendChild(pushStyle);
  document.body.appendChild(banner);

  document.getElementById('lt-demo-exit').onclick = function(){
    try { sessionStorage.removeItem('lt_demo'); } catch(e){}
    var url = new URL(location.href);
    url.searchParams.delete('demo');
    location.href = url.pathname + (url.search ? url.search : '');
  };
}

// ────────────────────────────────────────────────────────────────
// 5. Hide user-only features from landing nav unless signed in
// ────────────────────────────────────────────────────────────────
function patchLandingNav(){
  // The landing nav has: Languages | Parent Hub | Enter Classroom CTA
  // The user said: "My progress" shouldn't be on landing — it's a
  // user feature.  We don't currently have a "My progress" link on
  // the landing nav, but we'll guard against any future additions.
  // We also conditionally-show "Parent Hub" — for signed-in students
  // it's hidden (they shouldn't access parent hub).
  function refresh(){
    if (window.LTIsDemo && window.LTIsDemo()) return; // demo: don't hide anything
    var role = (window._LT_LAST_PROFILE && window._LT_LAST_PROFILE.role) || null;
    var navR = document.querySelector('#pg-landing .nav-r');
    if (!navR) return;
    var parentLink = navR.querySelector('a[onclick*="pg-parent"]');
    if (parentLink){
      parentLink.style.display = (role === 'student') ? 'none' : '';
    }
  }
  refresh();
  if (window.LTAuth && typeof window.LTAuth.onChange === 'function'){
    window.LTAuth.onChange(refresh);
  }
  window.addEventListener('lt-cloud-hydrated', refresh);
}

// ────────────────────────────────────────────────────────────────
// 6. Mobile rules toggle on the exam-confirm screen
// ────────────────────────────────────────────────────────────────
function patchRulesToggle(){
  // Watch for the rules header showing up and hook a tap to toggle.
  document.addEventListener('click', function(e){
    var hdr = e.target.closest && e.target.closest('.erc-rules-hdr');
    if (!hdr) return;
    if (window.innerWidth > 640) return; // only collapse on mobile
    var col = hdr.closest('.erc-rules-col');
    if (col) col.classList.toggle('expanded');
  }, false);
}

// ────────────────────────────────────────────────────────────────
// 7. Role label in account menu — show "Parent" or "Student"
// ────────────────────────────────────────────────────────────────
function patchRoleLabel(){
  // Watch for account menu being injected, then add role row
  var mo = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if (!(node instanceof HTMLElement)) return;
        if (!node.classList || !node.classList.contains('lt-acct-menu')) {
          // also check children
          var menu = node.querySelector && node.querySelector('.lt-acct-menu');
          if (menu) injectRoleRow(menu);
          return;
        }
        injectRoleRow(node);
      });
    });
  });
  mo.observe(document.body, { childList:true, subtree:true });
}
function injectRoleRow(menu){
  if (!menu || menu.querySelector('.lt-acct-role')) return;
  var profile = window._LT_LAST_PROFILE;
  if (!profile || !profile.role) return;
  var roleLabel = profile.role === 'parent' ? '👨‍👩‍👧 Parent' : (profile.role === 'student' ? '🎓 Student' : profile.role);
  var info = menu.querySelector('.lt-acct-info');
  if (!info) return;
  var pill = document.createElement('span');
  pill.className = 'lt-acct-role';
  pill.textContent = roleLabel;
  pill.style.cssText = 'display:inline-block;margin-top:6px;padding:3px 9px;background:rgba(251,191,36,.14);border:1px solid rgba(251,191,36,.3);color:#fbbf24;border-radius:100px;font-size:.7rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;';
  info.appendChild(pill);
}

// ────────────────────────────────────────────────────────────────
// 8. Remove "Enter Classroom" CTA from landing nav unless demo
// ────────────────────────────────────────────────────────────────
function patchLandingEnterCTA(){
  // Per spec: "Enter Classroom" should only appear on the demo banner
  // (which already has its own "Enter classroom" if demo mode), not on
  // the public landing nav. Hide the nav CTA in non-demo mode.
  function refresh(){
    if (window.LTIsDemo && window.LTIsDemo()) return; // demo: leave it
    document.querySelectorAll('#pg-landing .nav-cta').forEach(function(btn){
      // Only hide if it actually says "Enter Classroom"
      if (/enter classroom/i.test(btn.textContent || '')){
        btn.style.display = 'none';
      }
    });
    // Also the mobile drawer one
    document.querySelectorAll('#pg-landing .l-mobile-drawer .nav-cta').forEach(function(btn){
      if (/enter classroom/i.test(btn.textContent || '')){
        btn.style.display = 'none';
      }
    });
  }
  refresh();
  // Re-run after DOM changes (some scripts re-render the nav)
  setInterval(refresh, 1500);
}

// ────────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────────
function boot(){
  patchStreamFilter();
  patchMyProgressRouting();
  patchArenaGameClose();
  injectDemoBanner();
  patchLandingNav();
  patchRulesToggle();
  patchRoleLabel();
  patchLandingEnterCTA();
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', boot);
else
  boot();

})();
