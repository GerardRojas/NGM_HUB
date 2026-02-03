// ================================
// P&L (Profit & Loss) Report
// ================================

(function() {
  'use strict';

  // ================================
  // STATE
  // ================================
  let currentUser = null;
  let projects = [];
  let accounts = [];
  let selectedProjectId = null;
  let selectedProjectName = '';

  // Report options
  let reportOptions = {
    groupByAccount: true,
    showMargins: true,
    showEmptyAccounts: false,
    startDate: null,
    endDate: null
  };

  // ================================
  // CONFIG
  // ================================
  const apiBase = window.API_BASE || 'https://ngm-fastapi.onrender.com';

  // ================================
  // DOM ELEMENTS
  // ================================
  const els = {};

  function cacheElements() {
    els.projectSelect = document.getElementById('projectSelect');
    els.startDate = document.getElementById('startDate');
    els.endDate = document.getElementById('endDate');
    els.optionGroupByAccount = document.getElementById('optionGroupByAccount');
    els.optionShowMargins = document.getElementById('optionShowMargins');
    els.optionShowEmptyAccounts = document.getElementById('optionShowEmptyAccounts');
    els.btnGenerateReport = document.getElementById('btnGenerateReport');
    els.btnExportPDF = document.getElementById('btnExportPDF');
    els.reportResults = document.getElementById('reportResults');
    els.reportLoadingState = document.getElementById('reportLoadingState');
    els.reportContent = document.getElementById('reportContent');
    els.pageLoadingOverlay = document.getElementById('pageLoadingOverlay');
  }

  function hidePageLoading() {
    document.body.classList.remove('page-loading');
    document.body.classList.add('auth-ready');
    if (els.pageLoadingOverlay) {
      els.pageLoadingOverlay.classList.add('hidden');
    }
  }

  // ================================
  // AUTH
  // ================================
  function initAuth() {
    const userStr = localStorage.getItem('ngmUser');
    if (!userStr) {
      console.warn('[PNL_REPORT] No user found, redirecting to login');
      window.location.href = 'login.html';
      return false;
    }
    try {
      currentUser = JSON.parse(userStr);
      console.log('[PNL_REPORT] User:', currentUser);
      return true;
    } catch (e) {
      console.error('[PNL_REPORT] Error parsing user:', e);
      localStorage.removeItem('ngmUser');
      window.location.href = 'login.html';
      return false;
    }
  }

  // ================================
  // API HELPERS
  // ================================
  async function apiJson(url, options = {}) {
    const token = localStorage.getItem('ngmToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text);
        msg = json.detail || json.message || msg;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  // ================================
  // LOAD PROJECTS
  // ================================
  async function loadProjects() {
    try {
      console.log('[PNL_REPORT] Loading projects...');
      const url = `${apiBase}/projects`;
      const result = await apiJson(url);

      if (Array.isArray(result)) {
        projects = result;
      } else if (result?.data) {
        projects = result.data;
      } else if (result?.projects) {
        projects = result.projects;
      } else {
        projects = [];
      }

      console.log('[PNL_REPORT] Loaded projects:', projects.length);

      // Populate dropdown
      projects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_id || proj.id;
        option.textContent = proj.project_name || proj.name || 'Unnamed Project';
        els.projectSelect.appendChild(option);
      });

    } catch (err) {
      console.error('[PNL_REPORT] Error loading projects:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading projects.', { details: err.message });
      }
    }
  }

  // ================================
  // LOAD ACCOUNTS
  // ================================
  async function loadAccounts() {
    try {
      console.log('[PNL_REPORT] Loading accounts...');
      const url = `${apiBase}/accounts`;
      const result = await apiJson(url);

      if (Array.isArray(result)) {
        accounts = result;
      } else if (result?.data) {
        accounts = result.data;
      } else if (result?.accounts) {
        accounts = result.accounts;
      } else {
        accounts = [];
      }

      console.log('[PNL_REPORT] Loaded accounts:', accounts.length);
      return accounts;
    } catch (err) {
      console.error('[PNL_REPORT] Error loading accounts:', err);
      throw new Error('Failed to load accounts: ' + err.message);
    }
  }

  // ================================
  // EVENT LISTENERS
  // ================================
  function setupEventListeners() {
    // Project selection
    els.projectSelect?.addEventListener('change', (e) => {
      selectedProjectId = e.target.value;

      // Get selected project name
      const selectedOption = e.target.options[e.target.selectedIndex];
      selectedProjectName = selectedOption.textContent;

      console.log('[PNL_REPORT] Project selected:', selectedProjectId, selectedProjectName);

      // Enable/disable generate button
      if (els.btnGenerateReport) {
        els.btnGenerateReport.disabled = !selectedProjectId;
      }
    });

    // Date range inputs
    els.startDate?.addEventListener('change', (e) => {
      reportOptions.startDate = e.target.value || null;
      console.log('[PNL_REPORT] Start date:', reportOptions.startDate);
    });

    els.endDate?.addEventListener('change', (e) => {
      reportOptions.endDate = e.target.value || null;
      console.log('[PNL_REPORT] End date:', reportOptions.endDate);
    });

    // Report options checkboxes
    els.optionGroupByAccount?.addEventListener('change', (e) => {
      reportOptions.groupByAccount = e.target.checked;
    });

    els.optionShowMargins?.addEventListener('change', (e) => {
      reportOptions.showMargins = e.target.checked;
    });

    els.optionShowEmptyAccounts?.addEventListener('change', (e) => {
      reportOptions.showEmptyAccounts = e.target.checked;
    });

    // Generate report button
    els.btnGenerateReport?.addEventListener('click', async () => {
      await generateReport();
    });

    // Export PDF button
    els.btnExportPDF?.addEventListener('click', () => {
      exportToPDF();
    });
  }

  // ================================
  // GENERATE REPORT
  // ================================
  async function generateReport() {
    if (!selectedProjectId) {
      if (window.Toast) {
        Toast.warning('No Project', 'Please select a project first.');
      }
      return;
    }

    try {
      // Show loading state
      els.reportResults.style.display = 'block';
      els.reportLoadingState.style.display = 'flex';
      els.reportContent.style.display = 'none';

      console.log('[PNL_REPORT] Generating P&L report for project:', selectedProjectId);
      console.log('[PNL_REPORT] Report options:', reportOptions);

      // Try the new /qbo/pnl endpoint first, fallback to manual processing
      let pnlData;
      try {
        pnlData = await fetchPnLFromBackend(selectedProjectId);
        console.log('[PNL_REPORT] Got P&L data from backend:', pnlData);
      } catch (backendErr) {
        console.warn('[PNL_REPORT] Backend P&L endpoint not available, using manual processing:', backendErr.message);
        // Fallback: fetch transactions and process locally
        const qboTransactions = await fetchQBOTransactions(selectedProjectId);
        pnlData = processPnLData(qboTransactions);
      }

      console.log('[PNL_REPORT] P&L data:', pnlData);

      // Render report
      renderReport(pnlData);

      // Hide loading, show content
      els.reportLoadingState.style.display = 'none';
      els.reportContent.style.display = 'block';

      // Show Export PDF button
      if (els.btnExportPDF) {
        els.btnExportPDF.classList.remove('hidden');
      }

      console.log('[PNL_REPORT] Report generated successfully');

    } catch (err) {
      console.error('[PNL_REPORT] Error generating report:', err);
      if (window.Toast) {
        Toast.error('Report Failed', 'Error generating P&L report.', { details: err.message });
      }

      // Hide loading state
      els.reportLoadingState.style.display = 'none';
      els.reportResults.style.display = 'none';
    }
  }

  // ================================
  // FETCH P&L FROM BACKEND (NEW)
  // ================================
  async function fetchPnLFromBackend(projectId) {
    const url = `${apiBase}/qbo/pnl?project=${projectId}`;
    console.log('[PNL_REPORT] Fetching P&L from backend:', url);

    const result = await apiJson(url);

    // Transform backend response to frontend format
    const sortByAmount = (obj) => {
      return Object.entries(obj || {})
        .sort((a, b) => b[1] - a[1])
        .filter(([name, amount]) => reportOptions.showEmptyAccounts || amount > 0);
    };

    return {
      revenue: {
        items: result.revenue?.items || [],
        total: result.revenue?.total || 0
      },
      cogs: {
        accounts: sortByAmount(result.cogs?.by_account),
        total: result.cogs?.total || 0
      },
      grossProfit: result.gross_profit || 0,
      grossMargin: result.gross_margin || 0,
      operatingExpenses: {
        accounts: sortByAmount(result.operating_expenses?.by_account),
        total: result.operating_expenses?.total || 0
      },
      netIncome: result.net_income || 0,
      netMargin: result.net_margin || 0
    };
  }

  // ================================
  // FETCH QBO TRANSACTIONS (FALLBACK)
  // ================================
  async function fetchQBOTransactions(projectId) {
    try {
      // Fetch all QBO transactions for the project (no is_cogs filter to get everything)
      const url = `${apiBase}/qbo/expenses?project=${projectId}`;
      console.log('[PNL_REPORT] Fetching QBO transactions:', url);

      const result = await apiJson(url);

      let transactions = [];
      if (Array.isArray(result)) {
        transactions = result;
      } else if (result?.data) {
        transactions = result.data;
      } else if (result?.expenses) {
        transactions = result.expenses;
      }

      console.log('[PNL_REPORT] Fetched QBO transactions:', transactions.length);
      return transactions;
    } catch (err) {
      console.error('[PNL_REPORT] Error fetching QBO transactions:', err);
      throw new Error('Failed to load QBO transactions: ' + err.message);
    }
  }

  // ================================
  // PROCESS P&L DATA (FALLBACK)
  // ================================
  function processPnLData(transactions) {
    // Separate transactions by type and account category
    // Invoices/SalesReceipts = Revenue
    // Bills/Purchases with is_cogs = COGS
    // Bills/Purchases without is_cogs = Operating Expenses

    const revenue = {
      items: [],
      total: 0
    };

    const cogs = {
      byAccount: {},
      total: 0
    };

    const operatingExpenses = {
      byAccount: {},
      total: 0
    };

    // Helper to get account info
    const getAccountInfo = (accountId, accountName) => {
      if (accountId) {
        const found = accounts.find(a =>
          (a.account_id || a.id) === accountId ||
          a.AcctNum === accountId
        );
        if (found) {
          return {
            name: found.Name || found.account_name || accountName || 'Unknown Account',
            category: found.AccountCategory || '',
            isCogs: found.is_cogs ||
                    found.AccountCategory === 'Cost of Goods Sold' ||
                    found.AccountCategory === 'COGS' ||
                    found.AccountCategory === 'Cost of Sales'
          };
        }
      }
      return {
        name: accountName || 'Unknown Account',
        category: '',
        isCogs: false
      };
    };

    // Process each transaction
    transactions.forEach(txn => {
      const txnType = txn.txn_type || '';
      const signedAmount = parseFloat(txn.signed_amount || txn.Amount || txn.amount || 0);
      const accountInfo = getAccountInfo(txn.account_id, txn.account_name || txn.AccountName);
      const isCogs = txn.is_cogs || accountInfo.isCogs;
      const isIncome = txn.is_income || txnType === 'Invoice' || txnType === 'SalesReceipt';

      console.log('[PNL_REPORT] Processing transaction:', {
        txnType,
        description: txn.line_description || txn.LineDescription || txn.description,
        signedAmount,
        accountName: accountInfo.name,
        isCogs,
        isIncome
      });

      if (isIncome || signedAmount > 0) {
        // REVENUE - Invoices, SalesReceipts, or positive amounts
        const amount = Math.abs(signedAmount);
        revenue.items.push({
          description: txn.line_description || txn.LineDescription || txn.description || 'Income',
          account: accountInfo.name,
          amount: amount
        });
        revenue.total += amount;
      } else {
        // EXPENSE - negative amounts or expense transaction types
        const expenseAmount = Math.abs(signedAmount);

        if (isCogs) {
          // COGS
          if (!cogs.byAccount[accountInfo.name]) {
            cogs.byAccount[accountInfo.name] = 0;
          }
          cogs.byAccount[accountInfo.name] += expenseAmount;
          cogs.total += expenseAmount;
        } else {
          // Operating Expense
          if (!operatingExpenses.byAccount[accountInfo.name]) {
            operatingExpenses.byAccount[accountInfo.name] = 0;
          }
          operatingExpenses.byAccount[accountInfo.name] += expenseAmount;
          operatingExpenses.total += expenseAmount;
        }
      }
    });

    // Calculate P&L metrics
    const grossProfit = revenue.total - cogs.total;
    const grossMargin = revenue.total > 0 ? (grossProfit / revenue.total * 100) : 0;
    const netIncome = grossProfit - operatingExpenses.total;
    const netMargin = revenue.total > 0 ? (netIncome / revenue.total * 100) : 0;

    // Sort accounts by amount (descending)
    const sortByAmount = (obj) => {
      return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .filter(([name, amount]) => reportOptions.showEmptyAccounts || amount > 0);
    };

    return {
      revenue: {
        items: revenue.items,
        total: revenue.total
      },
      cogs: {
        accounts: sortByAmount(cogs.byAccount),
        total: cogs.total
      },
      grossProfit,
      grossMargin,
      operatingExpenses: {
        accounts: sortByAmount(operatingExpenses.byAccount),
        total: operatingExpenses.total
      },
      netIncome,
      netMargin
    };
  }

  // ================================
  // RENDER REPORT
  // ================================
  function renderReport(pnlData) {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build date range string
    let dateRangeStr = 'All Dates';
    if (reportOptions.startDate || reportOptions.endDate) {
      const start = reportOptions.startDate || 'Beginning';
      const end = reportOptions.endDate || 'Present';
      dateRangeStr = `${start} to ${end}`;
    }

    let html = `
      <div id="reportPrintable" class="pnl-report">
        <!-- Report Header -->
        <div class="pnl-header">
          <h1>PROFIT & LOSS</h1>
          <div class="pnl-subtitle">${selectedProjectName}</div>
          <div class="pnl-date-range">${dateRangeStr}</div>
        </div>

        <!-- REVENUE SECTION -->
        <div class="pnl-section">
          <div class="pnl-section-header">Revenue</div>
    `;

    // Revenue line items (if grouped by account)
    if (reportOptions.groupByAccount && pnlData.revenue.items.length > 0) {
      // Group revenue by account
      const revenueByAccount = {};
      pnlData.revenue.items.forEach(item => {
        if (!revenueByAccount[item.account]) {
          revenueByAccount[item.account] = 0;
        }
        revenueByAccount[item.account] += item.amount;
      });

      Object.entries(revenueByAccount).forEach(([account, amount]) => {
        html += `
          <div class="pnl-line-item">
            <span class="label">${account}</span>
            <span class="amount">$${formatCurrency(amount)}</span>
          </div>
        `;
      });
    } else if (pnlData.revenue.total === 0) {
      html += `
        <div class="pnl-line-item">
          <span class="label" style="color: #6b7280; font-style: italic;">No revenue recorded</span>
          <span class="amount">$0.00</span>
        </div>
      `;
    }

    html += `
          <div class="pnl-subtotal">
            <span class="label">TOTAL REVENUE</span>
            <span class="amount">$${formatCurrency(pnlData.revenue.total)}</span>
          </div>
        </div>

        <!-- COGS SECTION -->
        <div class="pnl-section">
          <div class="pnl-section-header cogs">Cost of Goods Sold</div>
    `;

    // COGS line items
    if (pnlData.cogs.accounts.length > 0) {
      pnlData.cogs.accounts.forEach(([account, amount]) => {
        html += `
          <div class="pnl-line-item">
            <span class="label">${account}</span>
            <span class="amount">$${formatCurrency(amount)}</span>
          </div>
        `;
      });
    } else {
      html += `
        <div class="pnl-line-item">
          <span class="label" style="color: #6b7280; font-style: italic;">No COGS recorded</span>
          <span class="amount">$0.00</span>
        </div>
      `;
    }

    html += `
          <div class="pnl-subtotal">
            <span class="label">TOTAL COGS</span>
            <span class="amount">$${formatCurrency(pnlData.cogs.total)}</span>
          </div>
        </div>

        <!-- GROSS PROFIT -->
        <div class="pnl-gross-profit ${pnlData.grossProfit < 0 ? 'negative' : ''}">
          <div class="label-group">
            <span class="label">GROSS PROFIT</span>
            ${reportOptions.showMargins ? `<span class="margin">Gross Margin: ${pnlData.grossMargin.toFixed(1)}%</span>` : ''}
          </div>
          <span class="amount">$${formatCurrency(pnlData.grossProfit)}</span>
        </div>

        <!-- OPERATING EXPENSES SECTION -->
        <div class="pnl-section">
          <div class="pnl-section-header opex">Operating Expenses</div>
    `;

    // Operating expense line items
    if (pnlData.operatingExpenses.accounts.length > 0) {
      pnlData.operatingExpenses.accounts.forEach(([account, amount]) => {
        html += `
          <div class="pnl-line-item">
            <span class="label">${account}</span>
            <span class="amount">$${formatCurrency(amount)}</span>
          </div>
        `;
      });
    } else {
      html += `
        <div class="pnl-line-item">
          <span class="label" style="color: #6b7280; font-style: italic;">No operating expenses recorded</span>
          <span class="amount">$0.00</span>
        </div>
      `;
    }

    html += `
          <div class="pnl-subtotal">
            <span class="label">TOTAL OPERATING EXPENSES</span>
            <span class="amount">$${formatCurrency(pnlData.operatingExpenses.total)}</span>
          </div>
        </div>

        <!-- NET INCOME -->
        <div class="pnl-net-income">
          <div class="label-group">
            <span class="label">NET INCOME</span>
            ${reportOptions.showMargins ? `<span class="margin">Net Margin: ${pnlData.netMargin.toFixed(1)}%</span>` : ''}
          </div>
          <span class="amount ${pnlData.netIncome < 0 ? 'negative' : ''}">$${formatCurrency(pnlData.netIncome)}</span>
        </div>

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #27272f; text-align: center;">
          <p style="font-size: 11px; color: #4b5563; margin: 0;">
            Generated from NGM Hub - P&L Report on ${today}
          </p>
        </div>
      </div>
    `;

    els.reportContent.innerHTML = html;
  }

  // ================================
  // FORMAT CURRENCY
  // ================================
  function formatCurrency(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    const isNegative = num < 0;
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isNegative ? `(${formatted})` : formatted;
  }

  // ================================
  // EXPORT TO PDF
  // ================================
  function exportToPDF() {
    const printContent = document.getElementById('reportPrintable');
    if (!printContent) {
      if (window.Toast) {
        Toast.warning('No Content', 'Report content not found.');
      }
      return;
    }

    // Create print-friendly styles
    const printStyles = `
      <style>
        @media print {
          body { margin: 0; padding: 20px; background: white; }
          @page { margin: 0.5in; }
        }
        .pnl-report {
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          max-width: 800px;
          margin: 0 auto;
        }
        .pnl-header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 2px solid #333;
          margin-bottom: 20px;
        }
        .pnl-header h1 {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 8px 0;
          color: #000;
        }
        .pnl-subtitle { font-size: 16px; color: #333; }
        .pnl-date-range { font-size: 12px; color: #666; margin-top: 4px; }
        .pnl-section { margin-bottom: 20px; }
        .pnl-section-header {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          padding: 8px 12px;
          background: #f5f5f5;
          border-left: 3px solid #333;
          margin-bottom: 8px;
        }
        .pnl-section-header.cogs { border-left-color: #f59e0b; }
        .pnl-section-header.opex { border-left-color: #3b82f6; }
        .pnl-line-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
        }
        .pnl-line-item .label { font-size: 13px; color: #333; }
        .pnl-line-item .amount { font-size: 13px; font-family: monospace; }
        .pnl-subtotal {
          display: flex;
          justify-content: space-between;
          padding: 10px 12px;
          background: #f5f5f5;
          border-top: 1px solid #333;
          margin-top: 8px;
        }
        .pnl-subtotal .label { font-weight: bold; font-size: 13px; }
        .pnl-subtotal .amount { font-weight: bold; font-size: 13px; font-family: monospace; }
        .pnl-gross-profit, .pnl-net-income {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border: 2px solid #333;
          margin: 20px 0;
        }
        .pnl-gross-profit .label, .pnl-net-income .label {
          font-size: 14px;
          font-weight: bold;
        }
        .pnl-gross-profit .margin, .pnl-net-income .margin {
          font-size: 12px;
          color: #666;
        }
        .pnl-gross-profit .amount, .pnl-net-income .amount {
          font-size: 18px;
          font-weight: bold;
          font-family: monospace;
        }
        .pnl-gross-profit.negative .amount,
        .pnl-net-income .amount.negative {
          color: #dc2626;
        }
      </style>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>P&L Report - ${selectedProjectName}</title>
        ${printStyles}
      </head>
      <body>
        ${printContent.outerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print();
    };
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    // Check authentication
    if (!initAuth()) return;

    // Cache DOM elements
    cacheElements();

    // Setup event listeners
    setupEventListeners();

    // Initialize topbar pills
    if (typeof window.initTopbarPills === 'function') {
      await window.initTopbarPills();
    }

    // Load projects and accounts in parallel
    await Promise.all([
      loadProjects(),
      loadAccounts()
    ]);

    // Hide page loading overlay
    hidePageLoading();

    console.log('[PNL_REPORT] Initialized successfully');
  }

  // ================================
  // START
  // ================================
  window.addEventListener('DOMContentLoaded', () => {
    init();
  });

})();
