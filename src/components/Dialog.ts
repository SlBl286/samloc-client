import { gsap } from 'gsap';

export class CustomDialog {
  private container: HTMLElement;
  private card: HTMLElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private inputWrapper: HTMLElement;
  private inputEl: HTMLInputElement;
  private btnCancel: HTMLButtonElement;
  private btnOk: HTMLButtonElement;
  private activeResolve: ((value: any) => void) | null = null;

  constructor() {
    this.container = document.getElementById('custom-dialog-container')!;
    this.card = document.getElementById('custom-dialog-card')!;
    this.titleEl = document.getElementById('custom-dialog-title')!;
    this.messageEl = document.getElementById('custom-dialog-message')!;
    this.inputWrapper = document.getElementById('custom-dialog-input-wrapper')!;
    this.inputEl = document.getElementById('custom-dialog-input') as HTMLInputElement;
    this.btnCancel = document.getElementById('custom-dialog-btn-cancel') as HTMLButtonElement;
    this.btnOk = document.getElementById('custom-dialog-btn-ok') as HTMLButtonElement;

    this.btnOk.addEventListener('click', () => this.handleOk());
    this.btnCancel.addEventListener('click', () => this.handleCancel());
  }

  public show(
    title: string,
    message: string,
    type: 'alert' | 'confirm' | 'prompt' = 'alert',
    defaultValue: string = ''
  ): Promise<any> {
    return new Promise((resolve) => {
      this.activeResolve = resolve;

      this.titleEl.innerText = title;
      this.messageEl.innerHTML = message;
      this.inputEl.value = defaultValue;

      if (type === 'prompt') {
        this.inputWrapper.classList.remove('hidden');
        this.btnCancel.classList.remove('hidden');
      } else if (type === 'confirm') {
        this.inputWrapper.classList.add('hidden');
        this.btnCancel.classList.remove('hidden');
      } else {
        this.inputWrapper.classList.add('hidden');
        this.btnCancel.classList.add('hidden');
      }

      this.container.classList.add('modal-show');
      this.card.classList.add('modal-scale-up');
      gsap.fromTo(this.card,
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
    });
  }

  private hide() {
    this.container.classList.remove('modal-show');
    this.card.classList.remove('modal-scale-up');
    this.activeResolve = null;
  }

  private handleOk() {
    if (this.activeResolve) {
      if (!this.inputWrapper.classList.contains('hidden')) {
        this.activeResolve(this.inputEl.value);
      } else {
        this.activeResolve(true);
      }
    }
    this.hide();
  }

  private handleCancel() {
    if (this.activeResolve) {
      if (!this.inputWrapper.classList.contains('hidden')) {
        this.activeResolve(null);
      } else {
        this.activeResolve(false);
      }
    }
    this.hide();
  }
}

export const dialog = new CustomDialog();
