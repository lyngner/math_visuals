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
  iframe.src = href;
  localStorage.setItem('currentPage', href);
  setActive(href);
});

