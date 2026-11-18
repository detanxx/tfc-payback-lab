(() => {
  const tag = document.currentScript;
  const labId = tag?.dataset.lab;
  const labTitle = tag?.dataset.title || 'this lab';
  const productionHosts = new Set(['payback-lab.tools.teenfinanceclub.com', 'tfc-payback-lab.vercel.app']);
  const isProductionHost = productionHosts.has(location.hostname) || (location.hostname === 'tools.teenfinanceclub.com' && (location.pathname === '/payback-lab' || location.pathname.startsWith('/payback-lab/')));
  if (!labId || location.protocol !== 'https:' || !isProductionHost) return;

  const formId = 'b70d5405-a553-4d37-8f25-f2acedd4df17';
  const storageKey = `tfc-${labId}-access-v1`;
  const cookieName = `tfc_${labId.replace(/[^a-z0-9_-]/gi, '_').replace(/-/g, '_')}_access`;
  const accessPeriod = 31536000000;
  const cookieNameValue = `${cookieName}=1`;

  function hasAccess() {
    let localExpiry = 0;
    try {
      localExpiry = Number(localStorage.getItem(storageKey)) || 0;
      if (localExpiry <= Date.now()) localStorage.removeItem(storageKey);
    } catch {}
    const cookieAccess = document.cookie.split(';').some((part) => part.trim() === cookieNameValue);
    return localExpiry > Date.now() || cookieAccess;
  }

  function initializeGate() {
    if (hasAccess()) return;

    const styles = document.createElement('style');
    styles.textContent = `
      #tfc-access-overlay{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:auto;padding:16px;background:rgba(22,22,51,.58);backdrop-filter:blur(5px)}
      .tfc-access-card{width:min(100%,460px);max-height:min(88dvh,980px);overflow:auto;padding:26px 24px;background:#fffdf8;border:1px solid rgba(226,226,235,.9);border-radius:24px;box-shadow:0 20px 60px rgba(22,22,51,.18);color:#1a1a57;font:16px/1.55 Inter,Arial,system-ui,sans-serif}
      .tfc-access-eyebrow{display:block;margin:0 0 10px;color:#64647d;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}
      .tfc-access-card h2{margin:0 0 10px;color:#1a1a57;font-size:clamp(24px,4.5vw,34px);font-weight:700;line-height:1.14;letter-spacing:-.8px}
      #tfc-access-title:focus{outline:none;box-shadow:none}
      .tfc-access-card p{margin:0 0 14px;color:#64647d;font-size:15px;line-height:1.55}
      #tfc-access-form{min-height:56px;margin-top:8px;width:100%}
      #tfc-access-form form{width:100%!important}
      #tfc-access-form fieldset,#tfc-access-form fieldset.form-columns-2,#tfc-access-form fieldset.form-columns-3{display:block!important;width:100%!important;max-width:100%!important}
      #tfc-access-form .hs-form-field{display:block!important;float:none!important;width:100%!important;max-width:100%!important;margin:0 0 14px!important}
      #tfc-access-form iframe{max-width:100%!important}
      #tfc-access-form input:not([type=checkbox]):not([type=radio]),#tfc-access-form select,#tfc-access-form textarea{max-width:100%;border:1px solid #b8b8cb;border-radius:9px;background:#fff;padding:10px 12px}
      #tfc-access-form input:focus-visible,#tfc-access-form select:focus-visible,#tfc-access-form textarea:focus-visible{outline:2px solid #1a1a57;outline-offset:2px}
      #tfc-access-form .hs-button,#tfc-access-form button[type=submit],#tfc-access-form input[type=submit]{min-height:46px;border:0;border-radius:10px;background:#b83c28;color:#fff;padding:10px 18px;font-weight:600}
      #tfc-access-status{margin-top:10px;font-size:13px}
      #tfc-access-overlay [hidden]{display:none!important}
      .tfc-access-card{position:relative}
      @media(max-width:520px){#tfc-access-overlay{padding:12px}.tfc-access-card{padding:22px 18px;max-height:calc(100dvh - 24px)}}
    `;
    document.head.appendChild(styles);

    const overlay = document.createElement('div');
    overlay.id = 'tfc-access-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tfc-access-title');

    const card = document.createElement('section');
    card.className = 'tfc-access-card';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'tfc-access-eyebrow';
    eyebrow.textContent = labTitle;
    const title = document.createElement('h2');
    title.id = 'tfc-access-title';
    title.tabIndex = -1;
    title.textContent = 'Enter your email to start';
    const description = document.createElement('p');
    description.textContent = 'Sign up once to unlock';
    const form = document.createElement('div');
    form.id = 'tfc-access-form';
    const status = document.createElement('p');
    status.id = 'tfc-access-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    card.append(eyebrow, title, description, form, status);
    overlay.append(card);
    document.body.insertBefore(overlay, document.body.firstChild);

    function setPageLocked(locked) {
      Array.from(document.body.children).forEach((element) => {
        if (element === overlay || element.tagName === 'SCRIPT') return;
        element.inert = locked;
        if (locked) element.setAttribute('aria-hidden', 'true');
        else element.removeAttribute('aria-hidden');
      });
      document.body.style.overflow = locked ? 'hidden' : '';
    }

    function showError(message) {
      status.textContent = message;
      status.hidden = false;
    }

    function unlock() {
      const expiry = Date.now() + accessPeriod;
      try { localStorage.setItem(storageKey, String(expiry)); } catch {}
      let cookie = `${cookieNameValue}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
      if (location.hostname.endsWith('.tools.teenfinanceclub.com')) cookie += '; Domain=.tools.teenfinanceclub.com';
      document.cookie = cookie;
      setPageLocked(false);
      overlay.remove();
      styles.remove();
      window.removeEventListener('hs-form-event:on-submission:success', onFormSuccess);
    }

    function onFormSuccess(event) {
      if (event.detail?.formId !== formId) return;
      unlock();
    }

    setPageLocked(true);
    window.addEventListener('hs-form-event:on-submission:success', onFormSuccess);

    const embedScript = document.createElement('script');
    embedScript.src = 'https://js.hsforms.net/forms/embed/v2.js';
    embedScript.async = true;
    embedScript.onload = () => {
      if (!window.hbspt?.forms?.create) {
        showError('The email form did not load. Refresh the page and try again.');
        return;
      }
      try {
        window.hbspt.forms.create({
          region: 'na1',
          portalId: '44855834',
          formId,
          target: '#tfc-access-form'
        });
      } catch {
        showError('The email form could not be opened. Refresh the page and try again.');
      }
    };
    embedScript.onerror = () => showError('The email form did not load. Check your connection or content blocker, then refresh to try again.');
    document.head.appendChild(embedScript);
    title.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGate, { once: true });
  } else {
    initializeGate();
  }
})();