const iframe = document.querySelector('iframe');
const nav = document.querySelector('nav');
const saved = localStorage.getItem('currentPage') || 'nkant.html';
iframe.src = saved;

function setActive(current) {
  nav.querySelectorAll('a').forEach(link => {
    const isActive = link.getAttribute('href') === current;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

setActive(saved);

nav.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  const currentSrc = iframe.getAttribute('src') || '';

  const toPath = value => {
    try {
      return new URL(value, window.location.href).pathname;
    } catch (error) {
      return value;
    }
  };

  const currentPath = currentSrc ? toPath(currentSrc) : null;
  const targetPath = toPath(href);
  const needsRefresh = currentPath === targetPath;

  let cacheBustingSrc = href;
  if (needsRefresh) {
    const [pathAndQuery, ...hashParts] = href.split('#');
    const hash = hashParts.length ? `#${hashParts.join('#')}` : '';
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    cacheBustingSrc = `${pathAndQuery}${separator}t=${Date.now()}${hash}`;
  }

  iframe.src = cacheBustingSrc;
  localStorage.setItem('currentPage', href);
  setActive(href);
});

