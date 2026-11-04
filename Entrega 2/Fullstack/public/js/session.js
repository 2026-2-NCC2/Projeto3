/**
 * Sessão do usuário (token + dados do usuário) guardada no localStorage.
 * Aplicação web regular: o localStorage é adequado aqui.
 */
const KEY = 'trocaticket.sessao';

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? null;
    } catch {
      return null;
    }
  },
  set(value) {
    localStorage.setItem(KEY, JSON.stringify(value));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
  token() {
    return this.get()?.token ?? null;
  },
  user() {
    return this.get()?.usuario ?? null;
  },
  updateUser(usuario) {
    const atual = this.get();
    if (atual) this.set({ ...atual, usuario });
  },
};
