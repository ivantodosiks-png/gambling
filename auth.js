class AuthManager {
  constructor() {
    this.currentUser = this.loadCurrentUser();
    this.balances = this.loadBalances();
    this.initializeAuth();
  }

  loadCurrentUser() {
    const stored = localStorage.getItem('gambling_current_user');
    return stored ? JSON.parse(stored) : null;
  }

  saveCurrentUser() {
    if (this.currentUser) {
      localStorage.setItem('gambling_current_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('gambling_current_user');
    }
  }

  loadBalances() {
    const stored = localStorage.getItem('gambling_balances');
    return stored ? JSON.parse(stored) : {};
  }

  saveBalances() {
    localStorage.setItem('gambling_balances', JSON.stringify(this.balances));
  }

  initializeAuth() {
    this.setupEventListeners();
    this.checkAuthStatus();
  }

  setupEventListeners() {
    document.getElementById('switchToRegister').addEventListener('click', () => this.switchForm('register'));
    document.getElementById('switchToLogin').addEventListener('click', () => this.switchForm('login'));
    document.getElementById('loginBtn').addEventListener('click', () => this.login());
    document.getElementById('registerBtn').addEventListener('click', () => this.register());

    document.getElementById('loginUsername').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });

    document.getElementById('regPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.register();
    });
    document.getElementById('regPasswordConfirm').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.register();
    });
  }

  switchForm(type) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (type === 'register') {
      loginForm.classList.remove('active');
      registerForm.classList.add('active');
    } else {
      registerForm.classList.remove('active');
      loginForm.classList.add('active');
    }

    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  validatePassword(password) {
    return password.length >= 6;
  }

  async api(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // ignore
    }

    if (!res.ok) {
      const message = data && data.error ? data.error : 'Server error';
      throw new Error(message);
    }

    return data;
  }

  ensureBalance(username) {
    if (!username) return;
    if (typeof this.balances[username] !== 'number') {
      this.balances[username] = 5000;
      this.saveBalances();
    }
  }

  async register() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const errorEl = document.getElementById('registerError');

    errorEl.textContent = '';

    if (!username || username.length < 3) {
      errorEl.textContent = 'Username must be at least 3 characters';
      return;
    }

    if (!this.validateEmail(email)) {
      errorEl.textContent = 'Invalid email address';
      return;
    }

    if (!this.validatePassword(password)) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    if (password !== passwordConfirm) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }

    try {
      const data = await this.api('/api/register', { username, email, password });
      this.currentUser = data.user;
      this.ensureBalance(this.currentUser?.username);
      this.saveCurrentUser();
      this.closeAuth();
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : 'Server error';
      return;
    }

    document.getElementById('regUsername').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regPasswordConfirm').value = '';
  }

  async login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    errorEl.textContent = '';

    if (!username || !password) {
      errorEl.textContent = 'Please enter username and password';
      return;
    }

    try {
      const data = await this.api('/api/login', { username, password });
      this.currentUser = data.user;
      this.ensureBalance(this.currentUser?.username);
      this.saveCurrentUser();
      this.closeAuth();
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : 'Server error';
      return;
    }

    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  }

  closeAuth() {
    const authOverlay = document.getElementById('authOverlay');
    authOverlay.classList.add('hidden');
    document.body.classList.remove('not-authenticated');
    this.updatePlayerUI();
  }

  logout() {
    this.currentUser = null;
    this.saveCurrentUser();
    this.showAuth();
  }

  showAuth() {
    const authOverlay = document.getElementById('authOverlay');
    authOverlay.classList.remove('hidden');
    document.body.classList.add('not-authenticated');
    this.switchForm('login');
  }

  checkAuthStatus() {
    if (!this.currentUser) {
      this.showAuth();
    } else {
      this.ensureBalance(this.currentUser?.username);
      this.updatePlayerUI();
    }
  }

  updatePlayerUI() {
    if (this.currentUser) {
      document.getElementById('balanceValue').textContent = this.getBalance();
      document.getElementById('playerIdValue').textContent = this.currentUser.username;
    }
  }

  getBalance() {
    if (!this.currentUser) return 0;
    const username = this.currentUser.username;
    const value = this.balances[username];
    return typeof value === 'number' ? value : 0;
  }

  setBalance(amount) {
    if (this.currentUser) {
      this.balances[this.currentUser.username] = amount;
      this.saveBalances();
      this.updatePlayerUI();
    }
  }

  addBalance(amount) {
    this.setBalance(this.getBalance() + amount);
  }

  subtractBalance(amount) {
    this.setBalance(this.getBalance() - amount);
  }
}

const authManager = new AuthManager();
