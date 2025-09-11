const routes = {
  'graftegner': 'graftegner.html',
  'nkant': 'nkant.html',
  'diagram': 'diagram/index.html',
  'brøkpizza': 'brøkpizza.html',
  'brøkvisualiseringer': 'brøkvisualiseringer.html',
  'tenkeblokker': 'tenkeblokker.html',
  'arealmodell0': 'arealmodell0.html',
  'arealmodellen1': 'arealmodellen1.html',
  'perlesnor': 'perlesnor.html'
};

async function loadPage(path, addToHistory = true) {
  const route = decodeURI(path).replace(/^\/+/, '');
  const fragment = routes[route];
  const content = document.getElementById('content');
  if (!fragment) {
    content.innerHTML = '<p>Siden finnes ikke.</p>';
    return;
  }

  const res = await fetch(fragment);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const baseURL = new URL(fragment, location.origin);

  // update title
  if (doc.title) {
    document.title = doc.title;
  }

  // swap head elements
  const head = document.head;
  head.querySelectorAll('[data-router]').forEach(el => el.remove());
  doc.head.querySelectorAll('link, style').forEach(el => {
    const clone = el.cloneNode(true);
    clone.setAttribute('data-router', '');
    if (clone.tagName === 'LINK' && clone.getAttribute('href')) {
      clone.href = new URL(clone.getAttribute('href'), baseURL).pathname;
    }
    head.appendChild(clone);
  });

  // inject body
  content.innerHTML = doc.body.innerHTML;

  // execute scripts with correct paths
  content.querySelectorAll('script').forEach(oldScript => {
    const script = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => {
      if (attr.name === 'src') {
        script.src = new URL(attr.value, baseURL).pathname;
      } else {
        script.setAttribute(attr.name, attr.value);
      }
    });
    script.textContent = oldScript.textContent;
    oldScript.replaceWith(script);
  });

  if (addToHistory) {
    history.pushState({ route }, '', '/' + route);
  }
  localStorage.setItem('currentPage', route);
}

window.loadPage = loadPage;

function init() {
  const initial = decodeURI(location.pathname.replace(/^\/+|\/+$/g, ''));
  const saved = localStorage.getItem('currentPage');
  const path = routes[initial] ? initial : (routes[saved] ? saved : 'nkant');
  loadPage(path, false);
}

window.addEventListener('popstate', (e) => {
  const route = e.state?.route || decodeURI(location.pathname.replace(/^\/+|\/+$/g, ''));
  loadPage(route, false);
});

init();
