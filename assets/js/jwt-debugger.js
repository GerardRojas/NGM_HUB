/**
 * JWT Debugger - Decode and inspect JWT tokens
 * Add this script to your HTML to debug JWT tokens in the console
 */

(function() {
  'use strict';

  function decodeJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode header
      const header = JSON.parse(atob(parts[0]));

      // Decode payload
      const payload = JSON.parse(atob(parts[1]));

      // Format expiration date
      if (payload.exp) {
        payload.exp_date = new Date(payload.exp * 1000).toLocaleString();
      }
      if (payload.iat) {
        payload.iat_date = new Date(payload.iat * 1000).toLocaleString();
      }

      return {
        header,
        payload,
        signature: parts[2]
      };
    } catch (error) {
      console.error('[JWT] Decode error:', error);
      return null;
    }
  }

  function debugCurrentJWT() {
    const token = localStorage.getItem('authToken');

    if (!token) {
      console.warn('[JWT] No token found in localStorage');
      return;
    }

    console.log('='.repeat(60));
    console.log('JWT TOKEN DEBUGGER');
    console.log('='.repeat(60));

    const decoded = decodeJWT(token);

    if (decoded) {
      console.log('\n📋 HEADER:');
      console.table(decoded.header);

      console.log('\n👤 PAYLOAD:');
      console.table(decoded.payload);

      console.log('\n🔑 Role from JWT:', decoded.payload.role);
      console.log('🆔 User ID:', decoded.payload.sub);
      console.log('👤 Username:', decoded.payload.username);
      console.log('⏰ Issued:', decoded.payload.iat_date);
      console.log('⏰ Expires:', decoded.payload.exp_date);

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const isExpired = decoded.payload.exp < now;
      console.log('\n⚠️  Token Status:', isExpired ? '❌ EXPIRED' : '✅ VALID');

      if (!isExpired) {
        const remainingSeconds = decoded.payload.exp - now;
        const remainingDays = Math.floor(remainingSeconds / 86400);
        const remainingHours = Math.floor((remainingSeconds % 86400) / 3600);
        console.log(`⏳ Time remaining: ${remainingDays}d ${remainingHours}h`);
      }

      // Check role for authorization
      const authorizedRoles = ['CEO', 'COO', 'Accounting Manager', 'Admin Guest'];
      const canAuthorize = authorizedRoles.includes(decoded.payload.role);
      console.log('\n🔐 Authorization Status:');
      console.log('   Can authorize expenses:', canAuthorize ? '✅ YES' : '❌ NO');
      console.log('   Authorized roles:', authorizedRoles.join(', '));
    }

    console.log('='.repeat(60));
  }

  // Expose to window
  window.debugJWT = debugCurrentJWT;

  // Auto-run on load if token exists
  window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('[JWT] Token found. Run window.debugJWT() to inspect it.');
    } else {
      console.log('[JWT] No token found in localStorage.');
    }
  });
})();
