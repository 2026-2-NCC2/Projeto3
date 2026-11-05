const DURATION_MS = { success: 4000, info: 4000, error: 6000 };

/**
 * Exibe uma mensagem temporária.
 * @param {string} message
 * @param {'success' | 'error' | 'info'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  container.appendChild(el);

  requestAnimationFrame(() => el.classList.add('visible'));

  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, DURATION_MS[type] ?? 4000);
}

export const toast = {
  success: (message) => showToast(message, 'success'),
  error: (message) => showToast(message, 'error'),
  info: (message) => showToast(message, 'info'),
};
