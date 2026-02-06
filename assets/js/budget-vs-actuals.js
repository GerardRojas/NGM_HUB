// ================================
// Budget Vs Actuals Report
// ================================

(function() {
  'use strict';

  // ================================
  // STATE
  // ================================
  let currentUser = null;
  let projects = [];
  let accounts = []; // Store accounts with AcctNum for sorting
  let selectedProjectId = null;
  let selectedProjectName = '';

  // Report options
  let reportOptions = {
    groupByAccount: true,
    showVariance: true,
    showPercentage: true,
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
    els.optionShowVariance = document.getElementById('optionShowVariance');
    els.optionShowPercentage = document.getElementById('optionShowPercentage');
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
      console.warn('[BUDGET_VS_ACTUALS] No user found, redirecting to login');
      window.location.href = 'login.html';
      return false;
    }
    try {
      currentUser = JSON.parse(userStr);
      console.log('[BUDGET_VS_ACTUALS] User:', currentUser);
      return true;
    } catch (e) {
      console.error('[BUDGET_VS_ACTUALS] Error parsing user:', e);
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
      console.log('[BUDGET_VS_ACTUALS] Loading projects...');
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

      console.log('[BUDGET_VS_ACTUALS] Loaded projects:', projects.length);

      // Populate dropdown
      projects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_id || proj.id;
        option.textContent = proj.project_name || proj.name || 'Unnamed Project';
        els.projectSelect.appendChild(option);
      });

    } catch (err) {
      console.error('[BUDGET_VS_ACTUALS] Error loading projects:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading projects.', { details: err.message });
      }
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

      console.log('[BUDGET_VS_ACTUALS] Project selected:', selectedProjectId, selectedProjectName);

      // Enable/disable generate button
      if (els.btnGenerateReport) {
        els.btnGenerateReport.disabled = !selectedProjectId;
      }
    });

    // Date range inputs
    els.startDate?.addEventListener('change', (e) => {
      reportOptions.startDate = e.target.value || null;
      console.log('[BUDGET_VS_ACTUALS] Start date:', reportOptions.startDate);
    });

    els.endDate?.addEventListener('change', (e) => {
      reportOptions.endDate = e.target.value || null;
      console.log('[BUDGET_VS_ACTUALS] End date:', reportOptions.endDate);
    });

    // Report options checkboxes
    els.optionGroupByAccount?.addEventListener('change', (e) => {
      reportOptions.groupByAccount = e.target.checked;
    });

    els.optionShowVariance?.addEventListener('change', (e) => {
      reportOptions.showVariance = e.target.checked;
    });

    els.optionShowPercentage?.addEventListener('change', (e) => {
      reportOptions.showPercentage = e.target.checked;
    });

    // Generate report button
    els.btnGenerateReport?.addEventListener('click', async () => {
      await generateReport();
    });

    // Export PDF button (in toolbar)
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

      console.log('[BUDGET_VS_ACTUALS] Generating report for project:', selectedProjectId);
      console.log('[BUDGET_VS_ACTUALS] Report options:', reportOptions);

      // Fetch budgets, expenses, and accounts in parallel
      const [budgetsResult, expensesResult, accountsResult] = await Promise.all([
        fetchBudgets(selectedProjectId),
        fetchExpenses(selectedProjectId),
        fetchAccounts()
      ]);

      console.log('[BUDGET_VS_ACTUALS] Budgets:', budgetsResult);
      console.log('[BUDGET_VS_ACTUALS] Expenses:', expensesResult);
      console.log('[BUDGET_VS_ACTUALS] Accounts:', accountsResult);

      // Store accounts for sorting
      accounts = accountsResult;

      // Process and compare data
      const reportData = processReportData(budgetsResult, expensesResult);

      console.log('[BUDGET_VS_ACTUALS] Report data:', reportData);

      // Render report
      renderReport(reportData);

      // Hide loading, show content
      els.reportLoadingState.style.display = 'none';
      els.reportContent.style.display = 'block';

      // Show Export PDF button in toolbar
      if (els.btnExportPDF) {
        els.btnExportPDF.classList.remove('hidden');
      }

      console.log('[BUDGET_VS_ACTUALS] Report generated successfully');

    } catch (err) {
      console.error('[BUDGET_VS_ACTUALS] Error generating report:', err);
      if (window.Toast) {
        Toast.error('Report Failed', 'Error generating report.', { details: err.message });
      }

      // Hide loading state
      els.reportLoadingState.style.display = 'none';
      els.reportResults.style.display = 'none';
    }
  }

  // ================================
  // FETCH BUDGETS
  // ================================
  async function fetchBudgets(projectId) {
    try {
      const url = `${apiBase}/budgets?project=${projectId}`;
      const result = await apiJson(url);

      let budgets = [];
      if (Array.isArray(result)) {
        budgets = result;
      } else if (result?.data) {
        budgets = result.data;
      } else if (result?.budgets) {
        budgets = result.budgets;
      }

      console.log('[BUDGET_VS_ACTUALS] Fetched budgets:', budgets.length);
      return budgets;
    } catch (err) {
      console.error('[BUDGET_VS_ACTUALS] Error fetching budgets:', err);
      throw new Error('Failed to load budget data: ' + err.message);
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

      console.log('[BUDGET_VS_ACTUALS] Fetched expenses:', expenses.length);
      return expenses;
    } catch (err) {
      console.error('[BUDGET_VS_ACTUALS] Error fetching expenses:', err);
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

      let accounts = [];
      if (Array.isArray(result)) {
        accounts = result;
      } else if (result?.data) {
        accounts = result.data;
      } else if (result?.accounts) {
        accounts = result.accounts;
      }

      console.log('[BUDGET_VS_ACTUALS] Fetched accounts:', accounts.length);
      return accounts;
    } catch (err) {
      console.error('[BUDGET_VS_ACTUALS] Error fetching accounts:', err);
      throw new Error('Failed to load account data: ' + err.message);
    }
  }

  // ================================
  // PROCESS REPORT DATA
  // ================================
  function processReportData(budgets, expenses) {
    // Helper function to resolve account name from account_id
    const getAccountName = (accountId, accountName) => {
      // If account_name is already provided, use it
      if (accountName) return accountName;

      // Otherwise, look up by account_id in accounts array
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

    // Group budgets by account_name
    const budgetsByAccount = {};
    budgets.forEach(budget => {
      const accountName = getAccountName(budget.account_id, budget.account_name);
      if (!budgetsByAccount[accountName]) {
        budgetsByAccount[accountName] = 0;
      }
      budgetsByAccount[accountName] += parseFloat(budget.amount_sum || 0);
    });

    // Group expenses by account_name and sum amounts
    // IMPORTANT: Only include authorized expenses (auth_status = true)
    const expensesByAccount = {};
    let totalExpensesCount = 0;
    let authorizedExpensesCount = 0;
    let skippedExpensesCount = 0;

    expenses.forEach(expense => {
      totalExpensesCount++;

      // Filter: Skip soft-deleted expenses (status = 'review')
      if (expense.status === 'review') {
        skippedExpensesCount++;
        return;
      }

      // Filter: Only include expenses that are authorized
      const isAuthorized = expense.auth_status === true;

      if (!isAuthorized) {
        skippedExpensesCount++;
        console.log('[BUDGET_VS_ACTUALS] Skipping unauthorized expense:', {
          expense_id: expense.expense_id,
          description: expense.LineDescription,
          amount: expense.Amount || expense.amount,
          auth_status: expense.auth_status
        });
        return; // Skip this expense
      }

      authorizedExpensesCount++;

      // Resolve account name from account_id or use existing account_name
      const accountName = getAccountName(expense.account_id, expense.account_name);

      console.log('[BUDGET_VS_ACTUALS] ✓ Processing authorized expense:', {
        account_id: expense.account_id,
        account_name: expense.account_name,
        resolved_name: accountName,
        amount: expense.Amount || expense.amount,
        auth_status: expense.auth_status
      });

      if (!expensesByAccount[accountName]) {
        expensesByAccount[accountName] = 0;
      }
      // Try both Amount and amount fields (case-sensitive)
      const expenseAmount = parseFloat(expense.Amount || expense.amount || 0);
      expensesByAccount[accountName] += expenseAmount;
    });

    console.log('[BUDGET_VS_ACTUALS] ========================================');
    console.log('[BUDGET_VS_ACTUALS] EXPENSE AUTHORIZATION SUMMARY:');
    console.log('[BUDGET_VS_ACTUALS] Total expenses:', totalExpensesCount);
    console.log('[BUDGET_VS_ACTUALS] Authorized expenses (included):', authorizedExpensesCount);
    console.log('[BUDGET_VS_ACTUALS] Unauthorized expenses (skipped):', skippedExpensesCount);
    console.log('[BUDGET_VS_ACTUALS] ========================================');

    console.log('[BUDGET_VS_ACTUALS] Expenses by account:', expensesByAccount);

    // Get all unique account names
    const allAccounts = new Set([
      ...Object.keys(budgetsByAccount),
      ...Object.keys(expensesByAccount)
    ]);

    // Build comparison data with account number for sorting
    const reportRows = [];
    allAccounts.forEach(accountName => {
      const budgetAmount = budgetsByAccount[accountName] || 0;
      const actualAmount = expensesByAccount[accountName] || 0;
      const balance = budgetAmount - actualAmount;
      const percentOfBudget = budgetAmount > 0 ? (actualAmount / budgetAmount * 100) : 0;

      // Find account number from accounts array
      const accountInfo = accounts.find(acc =>
        (acc.Name || acc.account_name) === accountName
      );
      const accountNumber = accountInfo?.AcctNum || 99999; // Put accounts without number at the end

      reportRows.push({
        account: accountName,
        accountNumber: accountNumber,
        actual: actualAmount,
        budget: budgetAmount,
        percentOfBudget: percentOfBudget,
        balance: balance
      });
    });

    // Sort by account number (AcctNum)
    reportRows.sort((a, b) => {
      // First by account number
      if (a.accountNumber !== b.accountNumber) {
        return a.accountNumber - b.accountNumber;
      }
      // If same number, sort by name
      return a.account.localeCompare(b.account);
    });

    // Calculate totals
    const totalActual = reportRows.reduce((sum, row) => sum + row.actual, 0);
    const totalBudget = reportRows.reduce((sum, row) => sum + row.budget, 0);
    const totalBalance = totalBudget - totalActual;
    const totalPercent = totalBudget > 0 ? (totalActual / totalBudget * 100) : 0;

    return {
      rows: reportRows,
      totals: {
        actual: totalActual,
        budget: totalBudget,
        balance: totalBalance,
        percentOfBudget: totalPercent
      }
    };
  }

  // ================================
  // RENDER REPORT
  // ================================
  function renderReport(reportData) {
    const { rows, totals } = reportData;

    // Get current date for header
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
          <h2 style="font-size: 16px; font-weight: normal; margin: 0 0 4px 0; color: #333;">Budget Vs Actuals Report : ${selectedProjectName}</h2>
          <p style="font-size: 12px; margin: 0; color: #666;">All Dates (Not Use this Report for Accounting Proposes)</p>
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
              <th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: bold;">BUDGET</th>
              ${reportOptions.showPercentage ? '<th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: bold;">% OF BUDGET</th>' : ''}
              ${reportOptions.showVariance ? '<th style="padding: 12px 8px; text-align: right; font-size: 13px; font-weight: bold;">BALANCE</th>' : ''}
            </tr>
          </thead>
          <tbody>
    `;

    // Render data rows
    rows.forEach(row => {
      const isOverBudget = row.balance < 0;
      const balanceColor = isOverBudget ? 'color: #dc2626;' : '';

      html += `
        <tr style="border-bottom: 1px solid #e5e5e5;">
          <td style="padding: 10px 8px; font-size: 12px;">${row.account}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 12px;">$${formatCurrency(row.actual)}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 12px;">$${formatCurrency(row.budget)}</td>
          ${reportOptions.showPercentage ? `<td style="padding: 10px 8px; text-align: right; font-size: 12px;">${row.percentOfBudget.toFixed(2)}%</td>` : ''}
          ${reportOptions.showVariance ? `<td style="padding: 10px 8px; text-align: right; font-size: 12px; ${balanceColor}">$${formatCurrency(row.balance)}</td>` : ''}
        </tr>
      `;
    });

    // Total row (moved to tbody so it only appears on last page)
    const isTotalOverBudget = totals.balance < 0;
    const totalBalanceColor = isTotalOverBudget ? 'color: #dc2626;' : '';

    html += `
            <tr style="background: #f5f5f5; border-top: 2px solid #333; font-weight: bold;">
              <td style="padding: 12px 8px; font-size: 13px;">TOTAL</td>
              <td style="padding: 12px 8px; text-align: right; font-size: 13px;">$${formatCurrency(totals.actual)}</td>
              <td style="padding: 12px 8px; text-align: right; font-size: 13px;">$${formatCurrency(totals.budget)}</td>
              ${reportOptions.showPercentage ? `<td style="padding: 12px 8px; text-align: right; font-size: 13px;">${totals.percentOfBudget.toFixed(2)}%</td>` : ''}
              ${reportOptions.showVariance ? `<td style="padding: 12px 8px; text-align: right; font-size: 13px; ${totalBalanceColor}">$${formatCurrency(totals.balance)}</td>` : ''}
            </tr>
          </tbody>
        </table>

        <!-- Footer note -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc;">
          <p style="font-size: 11px; color: #666; margin: 0;">
            Generated from NGM Hub - Budget Vs Actuals Report
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

    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Budget Vs Actuals Report - ${selectedProjectName}</title>
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

    // Initialize topbar pills (environment, server status, user)
    if (typeof window.initTopbarPills === 'function') {
      await window.initTopbarPills();
    }

    // Load projects
    await loadProjects();

    // Hide page loading overlay
    hidePageLoading();

    console.log('[BUDGET_VS_ACTUALS] Initialized successfully');
  }

  // ================================
  // START
  // ================================
  window.addEventListener('DOMContentLoaded', () => {
    init();
  });

})();
