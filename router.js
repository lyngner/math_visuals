const routes = {
  '/graftegner': 'graftegner.html',
  '/nkant': 'nkant.html',
  '/diagram': 'diagram/index.html',
  '/brøkpizza': 'brøkpizza.html',
  '/brøkvisualiseringer': 'brøkvisualiseringer.html',
  '/tenkeblokker': 'tenkeblokker.html',
  '/arealmodell0': 'arealmodell0.html',
  '/arealmodellen1': 'arealmodellen1.html',
  '/perlesnor': 'perlesnor.html'
};

async function loadPage(path, addToHistory = true) {
  const route = decodeURI(path);
  const fragment = routes[route];
  const content = document.getElementById('content');
  if (!fragment) {
    content.innerHTML = '<p>Siden finnes ikke.</p>';
    return;
  }
  const res = await fetch(fragment);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/html');
  content.innerHTML = doc.body.innerHTML;
  // execute scripts
  content.querySelectorAll('script').forEach(oldScript => {
    const script = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
    script.textContent = oldScript.textContent;
    oldScript.replaceWith(script);
  });
  if (addToHistory) {
    history.pushState({ route }, '', route);
  }
}

window.loadPage = loadPage;

function init() {
  const initial = decodeURI(location.pathname);
  const path = routes[initial] ? initial : '/nkant';
  loadPage(path, false);
}

window.addEventListener('popstate', (e) => {
  const route = e.state?.route || decodeURI(location.pathname);
  loadPage(route, false);
});

init();
