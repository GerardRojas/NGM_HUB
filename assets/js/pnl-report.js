// ================================
// P&L COGS Report
// Same format as BVA but without the budget column
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

  let reportOptions = {
    groupByAccount: true,
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
    els.btnGenerateReport = document.getElementById('btnGenerateReport');
    els.btnExportPDF = document.getElementById('btnExportPDF');
    els.reportResults = document.getElementById('reportResults');
    els.reportLoadingState = document.getElementById('reportLoadingState');
    els.reportContent = document.getElementById('reportContent');
    els.pageLoadingOverlay = document.getElementById('pageLoadingOverlay');
  }

  // ================================
  // AUTH
  // ================================
  function initAuth() {
    const userStr = localStorage.getItem('ngmUser');
    if (!userStr) {
      window.location.href = 'login.html';
      return false;
    }
    try {
      currentUser = JSON.parse(userStr);
      return true;
    } catch (e) {
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

      projects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_id || proj.id;
        option.textContent = proj.project_name || proj.name || 'Unnamed Project';
        els.projectSelect.appendChild(option);
      });

    } catch (err) {
      console.error('[PNL_COGS] Error loading projects:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading projects.', { details: err.message });
      }
    }
  }

  // ================================
  // EVENT LISTENERS
  // ================================
  function setupEventListeners() {
    els.projectSelect?.addEventListener('change', (e) => {
      selectedProjectId = e.target.value;
      const selectedOption = e.target.options[e.target.selectedIndex];
      selectedProjectName = selectedOption.textContent;

      if (els.btnGenerateReport) {
        els.btnGenerateReport.disabled = !selectedProjectId;
      }
    });

    els.startDate?.addEventListener('change', (e) => {
      reportOptions.startDate = e.target.value || null;
    });

    els.endDate?.addEventListener('change', (e) => {
      reportOptions.endDate = e.target.value || null;
    });

    els.optionGroupByAccount?.addEventListener('change', (e) => {
      reportOptions.groupByAccount = e.target.checked;
    });

    els.btnGenerateReport?.addEventListener('click', async () => {
      await generateReport();
    });

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
      els.reportResults.style.display = 'block';
      els.reportLoadingState.style.display = 'flex';
      els.reportContent.style.display = 'none';

      // Fetch expenses and accounts in parallel
      const [expensesResult, accountsResult] = await Promise.all([
        fetchExpenses(selectedProjectId),
        fetchAccounts()
      ]);

      accounts = accountsResult;

      const reportData = processReportData(expensesResult);

      renderReport(reportData);

      els.reportLoadingState.style.display = 'none';
      els.reportContent.style.display = 'block';

      if (els.btnExportPDF) {
        els.btnExportPDF.classList.remove('hidden');
      }

    } catch (err) {
      console.error('[PNL_COGS] Error generating report:', err);
      if (window.Toast) {
        Toast.error('Report Failed', 'Error generating P&L COGS report.', { details: err.message });
      }
      els.reportLoadingState.style.display = 'none';
      els.reportResults.style.display = 'none';
    }
  }

  // ================================
  // FETCH EXPENSES
  // ================================
  async function fetchExpenses(projectId) {
    try {
      const url = `${apiBase}/expenses?project=${projectId}`;
      const result = await apiJson(url);

      let expenses = [];
      if (Array.isArray(result)) {
        expenses = result;
      } else if (result?.data) {
        expenses = result.data;
      } else if (result?.expenses) {
        expenses = result.expenses;
      }

      return expenses;
    } catch (err) {
      console.error('[PNL_COGS] Error fetching expenses:', err);
      throw new Error('Failed to load expense data: ' + err.message);
    }
  }

  // ================================
  // FETCH ACCOUNTS
  // ================================
  async function fetchAccounts() {
    try {
      const url = `${apiBase}/accounts`;
      const result = await apiJson(url);

      let accts = [];
      if (Array.isArray(result)) {
        accts = result;
      } else if (result?.data) {
        accts = result.data;
      } else if (result?.accounts) {
        accts = result.accounts;
      }

      return accts;
    } catch (err) {
      console.error('[PNL_COGS] Error fetching accounts:', err);
      throw new Error('Failed to load account data: ' + err.message);
    }
  }

  // ================================
  // PROCESS REPORT DATA
  // Same logic as BVA but no budget column
  // ================================
  function processReportData(expenses) {
    const getAccountName = (accountId, accountName) => {
      if (accountName) return accountName;
      if (accountId) {
        const accountInfo = accounts.find(acc =>
          (acc.account_id || acc.id) === accountId
        );
        if (accountInfo) {
          return accountInfo.Name || accountInfo.account_name || 'Unknown Account';
        }
      }
      return 'Unknown Account';
    };

    // Group expenses by account (only authorized)
    const expensesByAccount = {};
    let authorizedCount = 0;
    let skippedCount = 0;

    expenses.forEach(expense => {
      if (expense.status === 'review') {
        skippedCount++;
        return;
      }

      const isAuthorized = expense.auth_status === true;
      if (!isAuthorized) {
        skippedCount++;
        return;
      }

      authorizedCount++;

      const accountName = getAccountName(expense.account_id, expense.account_name);
      if (!expensesByAccount[accountName]) {
        expensesByAccount[accountName] = 0;
      }
      const expenseAmount = parseFloat(expense.Amount || expense.amount || 0);
      expensesByAccount[accountName] += expenseAmount;
    });

    // Build rows with account number for sorting
    const reportRows = [];
    Object.keys(expensesByAccount).forEach(accountName => {
      const actualAmount = expensesByAccount[accountName];

      const accountInfo = accounts.find(acc =>
        (acc.Name || acc.account_name) === accountName
      );
      const accountNumber = accountInfo?.AcctNum || 99999;

      reportRows.push({
        account: accountName,
        accountNumber: accountNumber,
        actual: actualAmount
      });
    });

    // Sort by account number
    reportRows.sort((a, b) => {
      if (a.accountNumber !== b.accountNumber) {
        return a.accountNumber - b.accountNumber;
      }
      return a.account.localeCompare(b.account);
    });

    // Calculate total
    const totalActual = reportRows.reduce((sum, row) => sum + row.actual, 0);

    return {
      rows: reportRows,
      totals: {
        actual: totalActual
      },
      stats: {
        authorized: authorizedCount,
        skipped: skippedCount
      }
    };
  }

  // ================================
  // RENDER REPORT (same visual format as BVA)
  // ================================
  function renderReport(reportData) {
    const { rows, totals } = reportData;

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    let html = `
      <div id="reportPrintable" style="background: white; padding: 40px; color: black; font-family: Arial, sans-serif;">
        <!-- Report Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; color: #000;">KD Developers LLC</h1>
          <h2 style="font-size: 16px; font-weight: normal; margin: 0 0 4px 0; color: #333;">P&L COGS Report : ${selectedProjectName}</h2>
          <p style="font-size: 12px; margin: 0; color: #666;">All Dates (Not Use this Report for Accounting Purposes)</p>
        </div>

        <!-- Date stamp -->
        <div style="text-align: right; margin-bottom: 20px;">
          <div style="border: 2px solid #333; display: inline-block; padding: 8px 16px;">
            <strong style="font-size: 14px;">${today}</strong>
          </div>
        </div>

        <!-- Report Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #f5f5f5; border-top: 2px solid #333; border-bottom: 2px solid #333;">
              <th style="padding: 12px 8px; text-align: left; font-size: 13px; font-weight: bold;">ACCOUNT</th>
              <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: bold;">ACTUAL</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Render data rows
    rows.forEach(row => {
      html += `
        <tr style="border-bottom: 1px solid #e5e5e5;">
          <td style="padding: 10px 8px; font-size: 12px;">${row.account}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 12px;">$${formatCurrency(row.actual)}</td>
        </tr>
      `;
    });

    // Total row
    html += `
            <tr style="background: #f5f5f5; border-top: 2px solid #333; font-weight: bold;">
              <td style="padding: 12px 8px; font-size: 13px;">TOTAL</td>
              <td style="padding: 12px 8px; text-align: right; font-size: 13px;">$${formatCurrency(totals.actual)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer note -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc;">
          <p style="font-size: 11px; color: #666; margin: 0;">
            Generated from NGM Hub - P&L COGS Report
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
    return Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>P&L COGS Report - ${selectedProjectName}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 0.5in; }
          }
        </style>
      </head>
      <body>
        ${printContent.outerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = function() {
      printWindow.print();
    };
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    if (!initAuth()) return;

    cacheElements();
    setupEventListeners();

    if (typeof window.initTopbarPills === 'function') {
      await window.initTopbarPills();
    }

    await loadProjects();

    hidePageLoading();
  }

  // ================================
  // START
  // ================================
  window.addEventListener('DOMContentLoaded', () => {
    init();
  });

})();
