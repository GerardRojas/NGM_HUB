// ============================================
// NGM TABS — Reusable tab system
// ============================================
// Usage:
//   <div id="my-tabs">
//     <div class="ngm-tabs-nav">
//       <button class="ngm-tab-btn" data-tab="one">Tab One</button>
//       <button class="ngm-tab-btn" data-tab="two">Tab Two</button>
//     </div>
//     <div class="ngm-tab-panel" data-tab-panel="one">...</div>
//     <div class="ngm-tab-panel" data-tab-panel="two" hidden>...</div>
//   </div>
//
//   NGMTabs.init('my-tabs', {
//     onSwitch: (tabKey) => { ... },
//     permissionCheck: (tabKey) => bool
//   });

window.NGMTabs = (() => {
  'use strict';

  const _instances = new Map();

  function init(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const opts = options || {};
    const buttons = container.querySelectorAll('[data-tab]');
    const panels = container.querySelectorAll('[data-tab-panel]');

    // Hide tabs the user cannot see
    buttons.forEach(btn => {
      const tabKey = btn.dataset.tab;
      if (opts.permissionCheck && !opts.permissionCheck(tabKey)) {
        btn.style.display = 'none';
      }
    });

    // Click handlers
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.style.display === 'none') return;
        switchTab(containerId, btn.dataset.tab);
      });
    });

    _instances.set(containerId, {
      buttons: buttons,
      panels: panels,
      onSwitch: opts.onSwitch || null
    });

    // Activate first visible tab
    const firstVisible = Array.from(buttons).find(b => b.style.display !== 'none');
    if (firstVisible) {
      switchTab(containerId, firstVisible.dataset.tab);
    }
  }

  function switchTab(containerId, tabKey) {
    const inst = _instances.get(containerId);
    if (!inst) return;

    inst.buttons.forEach(b => {
      b.classList.toggle('ngm-tab-active', b.dataset.tab === tabKey);
    });

    inst.panels.forEach(p => {
      const isActive = p.dataset.tabPanel === tabKey;
      p.classList.toggle('ngm-tab-active', isActive);
      p.hidden = !isActive;
    });

    if (inst.onSwitch) {
      inst.onSwitch(tabKey);
    }
  }

  function destroy(containerId) {
    _instances.delete(containerId);
  }

  return { init, switchTab, destroy };
})();
