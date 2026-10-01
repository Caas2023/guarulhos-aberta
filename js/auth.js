const AUTH_CONFIG = {
  roles: {
    ADMIN: 'admin',
    SUPPLIER: 'supplier',
    BUYER: 'buyer'
  }
};

const storage = {
  get: (key) => JSON.parse(localStorage.getItem('ga_' + key) || 'null'),
  set: (key, val) => localStorage.setItem('ga_' + key, JSON.stringify(val))
};

class AuthManager {
  static login(user) {
    storage.set('user', user);
    storage.set('role', user.role);
    storage.set('token', 'session_' + Date.now());
  }
  static logout() {
    storage.set('user', null);
    storage.set('role', null);
    storage.set('token', null);
    window.location.href = '/';
  }
  static getUser() { return storage.get('user'); }
  static getRole() { return storage.get('role'); }
  static isAuthenticated() { return !!storage.get('token'); }
}

module.exports = { AuthManager, AUTH_CONFIG };
