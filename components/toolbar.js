export function createToolbar(container, buttons) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) return;
  buttons.forEach(btn => {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = btn.id;
    el.textContent = btn.text;
    el.className = btn.class || 'btn';
    if (btn.ariaLabel) el.setAttribute('aria-label', btn.ariaLabel);
    container.appendChild(el);
  });
}
