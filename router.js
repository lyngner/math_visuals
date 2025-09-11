const iframe = document.querySelector('iframe');
const links = document.querySelectorAll('nav a');
const saved = localStorage.getItem('currentPage') || 'nkant.html';
iframe.src = saved;

function setActive(current) {
  links.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === current);
  });
}

setActive(saved);

links.forEach(link => {
  link.addEventListener('click', () => {
    const href = link.getAttribute('href');
    localStorage.setItem('currentPage', href);
    setActive(href);
  });
});
