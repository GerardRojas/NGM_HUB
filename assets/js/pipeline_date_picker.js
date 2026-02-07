// assets/js/pipeline_date_picker.js
// Custom date picker for pipeline inline editing
(function () {
  'use strict';

  const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Creates a date picker attached to a cell.
   * @param {HTMLElement} anchorEl - The td cell to position relative to
   * @param {string|null} currentValue - Current date value (YYYY-MM-DD or ISO)
   * @param {function} onSelect - Called with YYYY-MM-DD string or null
   * @param {function} onClose - Called when picker closes without selection
   * @returns {{ container: HTMLElement, destroy: function }}
   */
  function createDatePicker(anchorEl, currentValue, onSelect, onClose) {
    // Parse current value
    let selectedDate = null;
    if (currentValue && currentValue !== '-') {
      const dateStr = currentValue.includes('T') ? currentValue.split('T')[0] : currentValue;
      const parsed = parseYMD(dateStr);
      if (parsed) selectedDate = parsed;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let viewYear = selectedDate ? selectedDate.getFullYear() : today.getFullYear();
    let viewMonth = selectedDate ? selectedDate.getMonth() : today.getMonth();

    // Build container
    const container = document.createElement('div');
    container.className = 'pm-datepicker';

    // Append to body to escape stacking contexts
    document.body.appendChild(container);
    positionPicker(container, anchorEl);

    // Render initial state
    render();

    // Close on outside click (delayed to avoid immediate close)
    let outsideClickHandler = null;
    setTimeout(() => {
      outsideClickHandler = (e) => {
        if (!container.contains(e.target) && !anchorEl.contains(e.target)) {
          cleanup();
          if (onClose) onClose();
        }
      };
      document.addEventListener('mousedown', outsideClickHandler, true);
    }, 50);

    // Close on Escape
    function keyHandler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        if (onClose) onClose();
      }
    }
    document.addEventListener('keydown', keyHandler, true);

    // Close on scroll of parent containers
    function scrollHandler() {
      positionPicker(container, anchorEl);
    }
    const scrollParents = getScrollParents(anchorEl);
    scrollParents.forEach(p => p.addEventListener('scroll', scrollHandler, { passive: true }));

    function cleanup() {
      container.remove();
      if (outsideClickHandler) {
        document.removeEventListener('mousedown', outsideClickHandler, true);
      }
      document.removeEventListener('keydown', keyHandler, true);
      scrollParents.forEach(p => p.removeEventListener('scroll', scrollHandler));
    }

    function render() {
      container.innerHTML = '';

      // Header: nav arrows + month/year
      const header = document.createElement('div');
      header.className = 'pm-datepicker-header';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'pm-datepicker-nav';
      prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        render();
      });

      const title = document.createElement('span');
      title.className = 'pm-datepicker-title';
      title.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'pm-datepicker-nav';
      nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        render();
      });

      header.appendChild(prevBtn);
      header.appendChild(title);
      header.appendChild(nextBtn);
      container.appendChild(header);

      // Day-of-week labels
      const dowRow = document.createElement('div');
      dowRow.className = 'pm-datepicker-dow';
      DAYS_SHORT.forEach(d => {
        const cell = document.createElement('span');
        cell.textContent = d;
        dowRow.appendChild(cell);
      });
      container.appendChild(dowRow);

      // Calendar grid
      const grid = document.createElement('div');
      grid.className = 'pm-datepicker-grid';

      const firstDay = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      // Previous month trailing days
      for (let i = firstDay - 1; i >= 0; i--) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pm-datepicker-day pm-datepicker-day--outside';
        cell.textContent = daysInPrevMonth - i;
        const pm = viewMonth === 0 ? 11 : viewMonth - 1;
        const py = viewMonth === 0 ? viewYear - 1 : viewYear;
        const day = daysInPrevMonth - i;
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          selectDate(py, pm, day);
        });
        grid.appendChild(cell);
      }

      // Current month days
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'pm-datepicker-day';

        const isToday = (d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear());
        const isSelected = selectedDate && (d === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear());

        if (isToday) cell.classList.add('pm-datepicker-day--today');
        if (isSelected) cell.classList.add('pm-datepicker-day--selected');

        cell.textContent = d;
        const day = d;
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          selectDate(viewYear, viewMonth, day);
        });
        grid.appendChild(cell);
      }

      // Next month leading days (fill to complete rows)
      const totalCells = firstDay + daysInMonth;
      const remainder = totalCells % 7;
      if (remainder > 0) {
        for (let d = 1; d <= 7 - remainder; d++) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'pm-datepicker-day pm-datepicker-day--outside';
          cell.textContent = d;
          const nm = viewMonth === 11 ? 0 : viewMonth + 1;
          const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
          const day = d;
          cell.addEventListener('click', (e) => {
            e.stopPropagation();
            selectDate(ny, nm, day);
          });
          grid.appendChild(cell);
        }
      }

      container.appendChild(grid);

      // Footer: Today + Clear buttons
      const footer = document.createElement('div');
      footer.className = 'pm-datepicker-footer';

      const todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = 'pm-datepicker-btn pm-datepicker-btn--today';
      todayBtn.textContent = 'Today';
      todayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectDate(today.getFullYear(), today.getMonth(), today.getDate());
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'pm-datepicker-btn pm-datepicker-btn--clear';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
        if (onSelect) onSelect(null);
      });

      footer.appendChild(todayBtn);
      footer.appendChild(clearBtn);
      container.appendChild(footer);
    }

    function selectDate(year, month, day) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cleanup();
      if (onSelect) onSelect(ymd);
    }

    return {
      container,
      destroy: cleanup
    };
  }

  // ================================
  // UTILITIES
  // ================================

  function parseYMD(str) {
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d);
  }

  function positionPicker(picker, anchor) {
    const rect = anchor.getBoundingClientRect();
    const pickerH = 310;
    const pickerW = 260;
    const margin = 4;

    let top = rect.bottom + margin;
    let left = rect.left;

    // Flip up if not enough space below
    if (top + pickerH > window.innerHeight - 8) {
      top = rect.top - pickerH - margin;
    }

    // Clamp to viewport right
    if (left + pickerW > window.innerWidth - 8) {
      left = window.innerWidth - pickerW - 8;
    }

    // Clamp to viewport left
    if (left < 8) left = 8;

    picker.style.position = 'fixed';
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    picker.style.zIndex = '9999';
  }

  function getScrollParents(el) {
    const parents = [];
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)) {
        parents.push(node);
      }
      node = node.parentElement;
    }
    parents.push(window);
    return parents;
  }

  /**
   * Formats a YYYY-MM-DD date string to a human-readable short form.
   * Examples: "Jan 15" (same year) or "Jan 15, 2024" (different year)
   */
  function formatDateDisplay(ymd) {
    if (!ymd || ymd === '-') return '-';
    const str = ymd.includes('T') ? ymd.split('T')[0] : ymd;
    const parsed = parseYMD(str);
    if (!parsed) return str;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parsed.getMonth()];
    const day = parsed.getDate();
    const year = parsed.getFullYear();
    const currentYear = new Date().getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    }
    return `${month} ${day}, ${year}`;
  }

  // Expose globally
  window.PM_DatePicker = { create: createDatePicker, formatDate: formatDateDisplay };

})();
