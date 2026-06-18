import { gsap } from 'gsap';
import { dialog } from './Dialog';

export interface UserSession {
  user_id: number;
  username: string;
  token: string;
}

export class AuthManager {
  private authModal: HTMLElement;
  private authCard: HTMLElement;
  private tabLogin: HTMLElement;
  private tabRegister: HTMLElement;
  private authError: HTMLElement;
  private inputUsername: HTMLInputElement;
  private inputPassword: HTMLInputElement;
  private btnSubmitAuth: HTMLButtonElement;
  private btnBypassAuth: HTMLButtonElement;
  private btnShowLogin: HTMLButtonElement;
  private userProfileWidget: HTMLElement;
  private usernameDisplay: HTMLElement;
  private btnLogout: HTMLButtonElement;

  private mode: 'login' | 'register' = 'login';
  private currentUser: UserSession | null = null;

  private onLoginSuccessCallback?: (session: UserSession) => void;
  private onLogoutCallback?: () => void;

  constructor(
    onLoginSuccess?: (session: UserSession) => void,
    onLogout?: () => void
  ) {
    this.onLoginSuccessCallback = onLoginSuccess;
    this.onLogoutCallback = onLogout;

    this.authModal = document.getElementById('auth-modal')!;
    this.authCard = document.getElementById('auth-card')!;
    this.tabLogin = document.getElementById('tab-login')!;
    this.tabRegister = document.getElementById('tab-register')!;
    this.authError = document.getElementById('auth-error')!;
    
    this.inputUsername = document.getElementById('input-username') as HTMLInputElement;
    this.inputPassword = document.getElementById('input-password') as HTMLInputElement;
    this.btnSubmitAuth = document.getElementById('btn-submit-auth') as HTMLButtonElement;
    this.btnBypassAuth = document.getElementById('btn-bypass-auth') as HTMLButtonElement;
    
    this.btnShowLogin = document.getElementById('btn-show-login') as HTMLButtonElement;
    this.userProfileWidget = document.getElementById('user-profile-widget')!;
    this.usernameDisplay = document.getElementById('username-display')!;
    this.btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

    this.setupListeners();
    this.restoreSession();
  }

  public getCurrentUser() {
    return this.currentUser;
  }

  public showModal() {
    this.authError.classList.add('hidden');
    this.authModal.classList.add('modal-show');
    gsap.fromTo(this.authCard,
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }
    );
  }

  public hideModal() {
    this.authModal.classList.remove('modal-show');
    this.inputUsername.value = '';
    this.inputPassword.value = '';
    this.authError.classList.add('hidden');
  }

  private setupListeners() {
    this.tabLogin.addEventListener('click', () => {
      this.mode = 'login';
      this.tabLogin.className = 'flex-1 text-center font-bold text-base text-white pb-2 border-b-2 border-pink-600 focus:outline-none cursor-pointer';
      this.tabRegister.className = 'flex-1 text-center font-bold text-base text-gray-400 pb-2 border-b-2 border-transparent hover:text-white focus:outline-none cursor-pointer';
      this.btnSubmitAuth.innerText = 'Đăng nhập';
      this.authError.classList.add('hidden');
    });

    this.tabRegister.addEventListener('click', () => {
      this.mode = 'register';
      this.tabRegister.className = 'flex-1 text-center font-bold text-base text-white pb-2 border-b-2 border-pink-600 focus:outline-none cursor-pointer';
      this.tabLogin.className = 'flex-1 text-center font-bold text-base text-gray-400 pb-2 border-b-2 border-transparent hover:text-white focus:outline-none cursor-pointer';
      this.btnSubmitAuth.innerText = 'Đăng ký';
      this.authError.classList.add('hidden');
    });

    this.btnSubmitAuth.addEventListener('click', () => this.handleAuthSubmit());
    this.btnBypassAuth.addEventListener('click', () => {
      this.hideModal();
      const guestId = Math.floor(Math.random() * 100000);
      const session: UserSession = {
        user_id: guestId,
        username: `Guest_${guestId}`,
        token: 'sandbox'
      };

      this.currentUser = session;
      localStorage.setItem('samloc_token', session.token);
      localStorage.setItem('samloc_username', session.username);
      localStorage.setItem('samloc_user_id', String(session.user_id));

      this.updateUI();

      if (this.onLoginSuccessCallback) {
        this.onLoginSuccessCallback(session);
      }
    });

    this.btnShowLogin.addEventListener('click', () => this.showModal());

    this.btnLogout.addEventListener('click', async () => {
      const confirmLogout = await dialog.show('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', 'confirm');
      if (confirmLogout) {
        this.logout();
      }
    });
  }

  private async handleAuthSubmit() {
    const username = this.inputUsername.value.trim();
    const password = this.inputPassword.value.trim();

    if (!username || !password) {
      this.showError('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    if (username.length < 3 || password.length < 4) {
      this.showError('Username từ 3 kí tự, Password từ 4 kí tự!');
      return;
    }

    const hostname = window.location.hostname || '127.0.0.1';
    const endpoint = `http://${hostname}:8081/${this.mode}`;

    try {
      this.btnSubmitAuth.classList.add('pointer-events-none', 'opacity-75');
      this.btnSubmitAuth.innerText = this.mode === 'login' ? 'Đang đăng nhập...' : 'Đang đăng ký...';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errMsg = await res.text();
        throw new Error(errMsg || 'Có lỗi xảy ra!');
      }

      if (this.mode === 'register') {
        this.authError.innerText = 'Đăng ký thành công! Hãy đăng nhập.';
        this.authError.className = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs mb-4 text-center';
        this.authError.classList.remove('hidden');
        setTimeout(() => this.tabLogin.click(), 1200);
      } else {
        const data = await res.json();
        const session: UserSession = {
          token: data.token,
          user_id: data.user_id,
          username: data.username,
        };

        this.currentUser = session;
        localStorage.setItem('samloc_token', session.token);
        localStorage.setItem('samloc_username', session.username);
        localStorage.setItem('samloc_user_id', String(session.user_id));

        this.updateUI();
        this.hideModal();

        if (this.onLoginSuccessCallback) {
          this.onLoginSuccessCallback(session);
        }
        await dialog.show('Đăng nhập', `Chào mừng trở lại, ${session.username}!`, 'alert');
      }
    } catch (err: any) {
      this.showError(err.message || 'Lỗi kết nối server!');
    } finally {
      this.btnSubmitAuth.classList.remove('pointer-events-none', 'opacity-75');
      this.btnSubmitAuth.innerText = this.mode === 'login' ? 'Đăng nhập' : 'Đăng ký';
    }
  }

  private logout() {
    localStorage.removeItem('samloc_token');
    localStorage.removeItem('samloc_username');
    localStorage.removeItem('samloc_user_id');
    this.currentUser = null;
    this.updateUI();
    
    if (this.onLogoutCallback) {
      this.onLogoutCallback();
    }
  }

  private restoreSession() {
    const token = localStorage.getItem('samloc_token');
    const username = localStorage.getItem('samloc_username');
    const userId = localStorage.getItem('samloc_user_id');

    if (token && username && userId) {
      const session = {
        token,
        username,
        user_id: parseInt(userId)
      };
      this.currentUser = session;
      this.updateUI();
      if (this.onLoginSuccessCallback) {
        this.onLoginSuccessCallback(session);
      }
    } else {
      this.showModal();
    }
  }

  private updateUI() {
    if (this.currentUser && this.currentUser.token) {
      this.usernameDisplay.innerText = this.currentUser.username;
      this.userProfileWidget.classList.remove('hidden');
      this.btnShowLogin.classList.add('hidden');
    } else {
      this.userProfileWidget.classList.add('hidden');
      this.btnShowLogin.classList.remove('hidden');
    }
  }

  private showError(msg: string) {
    this.authError.innerText = msg;
    this.authError.className = 'text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-xs mb-4 text-center';
    this.authError.classList.remove('hidden');
  }
}
