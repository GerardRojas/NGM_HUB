// ============================================================================
// NGM Hub - Firebase Push Notifications Initialization
// ============================================================================
// This script initializes Firebase and handles push notification registration
// Must be loaded after config.js

(function () {
  "use strict";

  // Firebase configuration
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDmeapFbTtmCLb2URK1ZO2DImOxLrhX0f4",
    authDomain: "ngm-connect-2db75.firebaseapp.com",
    projectId: "ngm-connect-2db75",
    storageBucket: "ngm-connect-2db75.firebasestorage.app",
    messagingSenderId: "679265932190",
    appId: "1:679265932190:web:9a6931cdefff7d01a3fc8f"
  };

  // VAPID key for web push
  const VAPID_KEY = "BIeAOO2Y2iiPMytGULMRcN3mDKTCvwb0AsrgucKH2lU3n30l0l558w6tafidLk2XZftX1YgvoX39tBA15QbdBsg";

  // State
  let firebaseApp = null;
  let messaging = null;
  let currentToken = null;
  let _foregroundHandlerInit = false;
  let _tokenRefreshInit = false;

  // ============================================================================
  // Initialize Firebase
  // ============================================================================

  async function initializeFirebase() {
    // Check if Firebase SDK is loaded
    if (typeof firebase === "undefined") {
      console.warn("[Firebase] SDK not loaded yet");
      return false;
    }

    try {
      // Initialize Firebase app (only once)
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      } else {
        firebaseApp = firebase.app();
      }

      // Get messaging instance
      messaging = firebase.messaging();

      console.log("[Firebase] Initialized successfully");
      return true;
    } catch (error) {
      console.error("[Firebase] Initialization error:", error);
      return false;
    }
  }

  // ============================================================================
  // Register Service Worker
  // ============================================================================

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      console.warn("[Firebase] Service workers not supported");
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("[Firebase] Service Worker registered:", registration.scope);
      return registration;
    } catch (error) {
      console.error("[Firebase] Service Worker registration failed:", error);
      return null;
    }
  }

  // ============================================================================
  // Request Notification Permission
  // ============================================================================

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      console.warn("[Firebase] Notifications not supported");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("[Firebase] Notifications were denied by user");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("[Firebase] Permission request failed:", error);
      return false;
    }
  }

  // ============================================================================
  // Get FCM Token
  // ============================================================================

  async function getFCMToken(swRegistration) {
    if (!messaging) {
      console.error("[Firebase] Messaging not initialized");
      return null;
    }

    try {
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration
      });

      if (token) {
        console.log("[Firebase] FCM Token obtained");
        currentToken = token;
        return token;
      } else {
        console.warn("[Firebase] No token available");
        return null;
      }
    } catch (error) {
      console.error("[Firebase] Error getting token:", error);
      return null;
    }
  }

  // ============================================================================
  // Save Token to Backend
  // ============================================================================

  async function saveTokenToBackend(token) {
    const authToken = localStorage.getItem("ngmToken");
    if (!authToken) {
      console.warn("[Firebase] No auth token, skipping token save");
      return false;
    }

    const apiBase = window.API_BASE || window.NGM_CONFIG?.API_BASE;
    if (!apiBase) {
      console.error("[Firebase] API_BASE not configured");
      return false;
    }

    try {
      const response = await fetch(`${apiBase}/notifications/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fcm_token: token,
          device_info: navigator.userAgent
        })
      });

      if (response.ok) {
        console.log("[Firebase] Token saved to backend");
        return true;
      } else {
        console.error("[Firebase] Failed to save token:", response.status);
        return false;
      }
    } catch (error) {
      console.error("[Firebase] Error saving token:", error);
      return false;
    }
  }

  // ============================================================================
  // Handle Foreground Messages
  // ============================================================================

  function setupForegroundMessageHandler() {
    if (!messaging || _foregroundHandlerInit) return;
    _foregroundHandlerInit = true;

    messaging.onMessage((payload) => {
      console.log("[Firebase] Foreground message received:", payload);

      const title = payload.notification?.title || payload.data?.title || "NGM Hub";
      const body = payload.notification?.body || payload.data?.body || "New notification";
      const senderName = payload.data?.sender_name || null;
      const avatarColor = payload.data?.avatar_color || null;

      // Use Toast system if available
      if (window.Toast) {
        const toastOpts = {
          avatar: senderName ? {
            name: senderName,
            color: avatarColor
          } : null,
          onClick: () => {
            const url = payload.data?.url || "/messages.html";
            window.location.href = url;
          }
        };

        const msgType = payload.data?.type || "mention";
        if (msgType === "message" && window.Toast.chat) {
          window.Toast.chat(title, body, toastOpts);
        } else if (window.Toast.mention) {
          window.Toast.mention(title, body, toastOpts);
        }
      } else {
        // Fallback to native notification
        if (Notification.permission === "granted") {
          new Notification(title, {
            body: body,
            icon: "/assets/img/greenblack_icon.png"
          });
        }
      }

      // Notify chat widget for badge update
      if (window.ChatWidget && window.ChatWidget.handlePushNotification) {
        window.ChatWidget.handlePushNotification(payload);
      }
    });
  }

  // ============================================================================
  // Main Initialization Flow
  // ============================================================================

  async function initializePushNotifications() {
    // Wait for Firebase SDK to be loaded
    if (typeof firebase === "undefined") {
      console.log("[Firebase] Waiting for SDK...");
      return;
    }

    // Only initialize on authenticated pages
    const authToken = localStorage.getItem("ngmToken");
    if (!authToken) {
      console.log("[Firebase] Not authenticated, skipping push setup");
      return;
    }

    // Initialize Firebase
    const initialized = await initializeFirebase();
    if (!initialized) return;

    // Register service worker
    const swRegistration = await registerServiceWorker();
    if (!swRegistration) return;

    // Request permission (non-blocking, user can deny)
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log("[Firebase] Notification permission not granted");
      return;
    }

    // Get FCM token
    const token = await getFCMToken(swRegistration);
    if (!token) return;

    // Save token to backend
    await saveTokenToBackend(token);

    // Setup foreground message handler
    setupForegroundMessageHandler();

    console.log("[Firebase] Push notifications fully initialized");
  }

  // ============================================================================
  // Token Refresh Handler
  // ============================================================================

  function setupTokenRefreshHandler() {
    if (!messaging || _tokenRefreshInit) return;
    _tokenRefreshInit = true;

    // Firebase v9+ doesn't have onTokenRefresh, we handle it differently
    // Token refresh is automatic, we just need to save new tokens periodically
    setInterval(async () => {
      if (messaging && Notification.permission === "granted") {
        try {
          const swRegistration = await navigator.serviceWorker.getRegistration();
          if (swRegistration) {
            const newToken = await messaging.getToken({
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: swRegistration
            });
            if (newToken && newToken !== currentToken) {
              console.log("[Firebase] Token refreshed");
              currentToken = newToken;
              await saveTokenToBackend(newToken);
            }
          }
        } catch (error) {
          console.error("[Firebase] Token refresh error:", error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  // ============================================================================
  // Expose API
  // ============================================================================

  window.NGMPush = {
    initialize: initializePushNotifications,
    requestPermission: requestNotificationPermission,
    getToken: () => currentToken,
    isSupported: () => "serviceWorker" in navigator && "Notification" in window
  };

  // ============================================================================
  // Auto-initialize when DOM is ready and Firebase SDK is loaded
  // ============================================================================

  function onReady() {
    // Small delay to ensure Firebase SDK is fully loaded
    setTimeout(initializePushNotifications, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

})();
