/**
 * Transcribble - Custom Comic Modals & Toast Engine
 * Handles in-game custom confirm dialogs, privacy modal, and floating toast notifications
 */

(function() {
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Floating Disappearing Toast Notification System
   */
  function showToast(text, type = 'info', icon = '🔔', duration = 3500) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${escapeHTML(text)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 320);
    }, duration);
  }

  /**
   * Comic Black & White Modal Confirmation Dialog
   */
  function showGameConfirmModal({
    icon = '⚠️',
    badge = 'ACTIVE MATCH IN PROGRESS',
    title = 'Change Game Mode?',
    message = 'Changing the game mode will cancel the current game in progress and return everyone to the lobby.',
    targetName = 'Classic Mode',
    subnote = 'Active turns and drawings will be cleared.',
    confirmText = 'Cancel Game & Switch',
    cancelText = 'Keep Playing',
    showInput = false,
    inputValue = '',
    inputPlaceholder = 'Enter text...',
    inputMaxLength = 18
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('gameConfirmModal');
      if (!modal) {
        if (showInput) {
          resolve(prompt(message || title, inputValue));
        } else {
          resolve(confirm(`${title}\n\n${message} ${targetName || ''}`));
        }
        return;
      }

      const iconEl = document.getElementById('gameConfirmIcon');
      const badgeEl = document.getElementById('gameConfirmBadge');
      const titleEl = document.getElementById('gameConfirmTitle');
      const descEl = document.getElementById('gameConfirmDesc');
      const targetBadgeEl = document.getElementById('gameConfirmTargetBadge');
      const targetWrap = document.getElementById('gameConfirmTargetWrap');
      const inputWrap = document.getElementById('gameConfirmInputWrap');
      const inputEl = document.getElementById('gameConfirmInput');
      const subnoteEl = document.getElementById('gameConfirmSubnote');
      const btnCancel = document.getElementById('btnGameConfirmCancel');
      const btnOk = document.getElementById('btnGameConfirmOk');

      if (iconEl) iconEl.textContent = icon;
      if (badgeEl) badgeEl.textContent = badge;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = message;

      if (showInput && inputWrap && inputEl) {
        inputWrap.style.display = 'block';
        inputEl.value = inputValue || '';
        inputEl.placeholder = inputPlaceholder || '';
        inputEl.maxLength = inputMaxLength || 18;
        if (targetWrap) targetWrap.style.display = 'none';
        setTimeout(() => {
          inputEl.focus();
          inputEl.select();
        }, 50);
      } else {
        if (inputWrap) inputWrap.style.display = 'none';
        if (targetBadgeEl && targetWrap) {
          if (targetName) {
            targetBadgeEl.textContent = targetName;
            targetWrap.style.display = 'block';
          } else {
            targetWrap.style.display = 'none';
          }
        }
      }

      if (subnoteEl) {
        subnoteEl.textContent = subnote || '';
        subnoteEl.style.display = subnote ? 'block' : 'none';
      }

      if (btnCancel) btnCancel.textContent = cancelText;
      if (btnOk) btnOk.textContent = confirmText;

      modal.style.display = 'flex';

      function cleanUp() {
        modal.style.display = 'none';
        btnCancel?.removeEventListener('click', handleCancel);
        btnOk?.removeEventListener('click', handleConfirm);
        modal.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeyDown);
      }

      function handleConfirm() {
        if (showInput && inputEl) {
          const val = inputEl.value.trim();
          cleanUp();
          resolve(val || null);
        } else {
          cleanUp();
          resolve(true);
        }
      }

      function handleCancel() {
        cleanUp();
        resolve(showInput ? null : false);
      }

      function handleOverlayClick(e) {
        if (e.target === modal) {
          cleanUp();
          resolve(showInput ? null : false);
        }
      }

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
      }

      btnCancel?.addEventListener('click', handleCancel);
      btnOk?.addEventListener('click', handleConfirm);
      modal.addEventListener('click', handleOverlayClick);
      document.addEventListener('keydown', handleKeyDown);
    });
  }

  // Privacy modal setup
  document.addEventListener('DOMContentLoaded', () => {
    const btnPrivacyModalToggle = document.getElementById('btnPrivacyModalToggle');
    const privacyModalOverlay = document.getElementById('privacyModalOverlay');
    const btnClosePrivacyModal = document.getElementById('btnClosePrivacyModal');
    const btnPrivacyDone = document.getElementById('btnPrivacyDone');

    function openPrivacyModal() {
      if (privacyModalOverlay) privacyModalOverlay.style.display = 'flex';
    }

    function closePrivacyModal() {
      if (privacyModalOverlay) privacyModalOverlay.style.display = 'none';
    }

    if (btnPrivacyModalToggle) btnPrivacyModalToggle.addEventListener('click', openPrivacyModal);
    if (btnClosePrivacyModal) btnClosePrivacyModal.addEventListener('click', closePrivacyModal);
    if (btnPrivacyDone) btnPrivacyDone.addEventListener('click', closePrivacyModal);
    if (privacyModalOverlay) {
      privacyModalOverlay.addEventListener('click', (e) => {
        if (e.target === privacyModalOverlay) closePrivacyModal();
      });
    }
  });

  // Export to window
  window.showToast = showToast;
  window.showGameConfirmModal = showGameConfirmModal;
  window.escapeHTML = escapeHTML;
})();
