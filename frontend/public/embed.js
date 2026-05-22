/**
 * FAQ RAG Widget Embed Script
 * Usage: <script src="https://your-domain.com/embed.js" data-tenant="TENANT_ID"></script>
 * Options:
 *   data-tenant    (required) Tenant ID
 *   data-position  "bottom-right" (default) | "bottom-left"
 */
(function () {
  var cs = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var tenantId = cs.getAttribute('data-tenant');
  if (!tenantId) { console.warn('[FAQ Widget] data-tenant is required'); return; }

  var base = cs.src.replace(/\/embed\.js(\?.*)?$/, '');
  var widgetSrc = base + '/widget/' + tenantId;
  var leftSide = cs.getAttribute('data-position') === 'bottom-left';
  var side = leftSide ? 'left' : 'right';

  var styleEl = document.createElement('style');
  styleEl.textContent =
    '#faq-chat-btn{position:fixed;bottom:24px;' + side + ':24px;width:56px;height:56px;' +
    'background:linear-gradient(135deg,#1d4ed8,#38bdf8);color:#fff;border:none;border-radius:50%;' +
    'cursor:pointer;box-shadow:0 4px 20px rgba(29,78,216,.4);z-index:999999;' +
    'display:flex;align-items:center;justify-content:center;padding:0;' +
    'transition:transform .2s,box-shadow .2s}' +
    '#faq-chat-btn:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(29,78,216,.5)}' +
    '#faq-chat-win{position:fixed;bottom:92px;' + side + ':24px;width:360px;height:520px;' +
    'border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.18);z-index:999998;' +
    'transform:scale(.95) translateY(12px);opacity:0;pointer-events:none;' +
    'transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .2s}' +
    '#faq-chat-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:auto}' +
    '#faq-chat-win iframe{width:100%;height:100%;border:none}';
  document.head.appendChild(styleEl);

  var ICON_CHAT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var btn = document.createElement('button');
  btn.id = 'faq-chat-btn';
  btn.title = '客服助理';
  btn.innerHTML = ICON_CHAT;
  document.body.appendChild(btn);

  var win = document.createElement('div');
  win.id = 'faq-chat-win';
  var iframe = document.createElement('iframe');
  iframe.title = '客服助理';
  iframe.setAttribute('allow', 'clipboard-write');
  win.appendChild(iframe);
  document.body.appendChild(win);

  var isOpen = false;
  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    if (isOpen && !iframe.src) iframe.src = widgetSrc; // lazy load
    btn.innerHTML = isOpen ? ICON_CLOSE : ICON_CHAT;
  });
})();
