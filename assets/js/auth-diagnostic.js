/**
 * Authorization Diagnostic Tool
 * Run window.diagAuth() in console to check authorization setup
 */

(function() {
  'use strict';

  function diagnoseAuth() {
    console.clear();
    console.log('='.repeat(60));
    console.log('AUTHORIZATION DIAGNOSTIC');
    console.log('='.repeat(60));

    // 1. Check localStorage user
    const userRaw = localStorage.getItem('ngmUser');
    if (!userRaw) {
      console.error('❌ No user found in localStorage');
      console.log('Solution: Log in again');
      return;
    }

    let user;
    try {
      user = JSON.parse(userRaw);
      console.log('✅ User found in localStorage');
    } catch (e) {
      console.error('❌ Invalid JSON in localStorage');
      console.log('Solution: Clear localStorage and log in again');
      return;
    }

    // 2. Check user role
    console.log('\n📋 USER INFORMATION:');
    console.table({
      'User ID': user.user_id || user.id || 'N/A',
      'Username': user.user_name || user.name || user.username || 'N/A',
      'Role (user_role)': user.user_role || 'N/A',
      'Role (role)': user.role || 'N/A',
      'Role (user_type)': user.user_type || 'N/A'
    });

    const userRole = user.user_role || user.role || user.user_type || '';
    console.log('\n🔑 Detected Role:', `"${userRole}"`);

    // 3. Check authorized roles
    const AUTHORIZED_ROLES = ['CEO', 'COO', 'Accounting Manager', 'Admin Guest'];
    console.log('\n✅ Authorized Roles:', AUTHORIZED_ROLES);

    // 4. Check if user can authorize
    const canAuthorize = AUTHORIZED_ROLES.includes(userRole);
    console.log('\n🔐 Can Authorize Expenses:', canAuthorize ? '✅ YES' : '❌ NO');

    if (!canAuthorize) {
      console.log('\n⚠️  AUTHORIZATION DENIED');
      console.log('Your role:', `"${userRole}"`);
      console.log('Authorized roles:', AUTHORIZED_ROLES.join(', '));

      // Check for close matches
      const closeMatches = AUTHORIZED_ROLES.filter(role =>
        role.toLowerCase().includes(userRole.toLowerCase()) ||
        userRole.toLowerCase().includes(role.toLowerCase())
      );

      if (closeMatches.length > 0) {
        console.warn('\n⚠️  POSSIBLE MISMATCH DETECTED!');
        console.warn('Your role:', `"${userRole}"`);
        console.warn('Close matches:', closeMatches);
        console.warn('Check for:');
        console.warn('  - Extra spaces');
        console.warn('  - Capitalization differences');
        console.warn('  - Spelling differences');
      }
    } else {
      console.log('\n✅ AUTHORIZATION GRANTED');
      console.log('You can authorize expenses via:');
      console.log('  1. Clicking the badge in the table');
      console.log('  2. Using the checkbox in the edit modal');
    }

    // 5. Check JWT token
    console.log('\n📄 JWT TOKEN CHECK:');
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('⚠️  No authToken found in localStorage');
      console.log('This might be OK if using a different auth method');
    } else {
      console.log('✅ JWT token present');
      console.log('Run window.debugJWT() for detailed token info');
    }

    // 6. Check DOM elements
    console.log('\n🎨 UI ELEMENTS CHECK:');
    const authContainer = document.getElementById('singleExpenseAuthContainer');
    const authCheckbox = document.getElementById('singleExpenseAuthStatus');

    console.table({
      'Auth Container': authContainer ? '✅ Found' : '❌ Not found',
      'Auth Checkbox': authCheckbox ? '✅ Found' : '❌ Not found',
      'Container Visible': authContainer ? (authContainer.style.display !== 'none' ? '✅ Visible' : '❌ Hidden') : 'N/A'
    });

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
  }

  // Expose to window
  window.diagAuth = diagnoseAuth;

  console.log('[AUTH DIAGNOSTIC] Loaded. Run window.diagAuth() to check authorization setup');
})();
