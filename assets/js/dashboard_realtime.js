// assets/js/dashboard_realtime.js
// Supabase Realtime subscription for Dashboard
// Enables live updates for My Work, Pending Reviews, and Mentions

(function() {
  'use strict';

  let supabaseClient = null;
  let tasksSubscription = null;
  let mentionsSubscription = null;
  let _taskRetries = 0;
  let _mentionRetries = 0;
  var MAX_RETRIES = 5;
  var BACKOFF = [5000, 10000, 20000, 40000, 60000];

  // ================================
  // INITIALIZATION
  // ================================

  function init() {
    const supabaseUrl = window.SUPABASE_URL || window.NGM_CONFIG?.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_ANON_KEY || window.NGM_CONFIG?.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[DASH_REALTIME] Supabase config not found, realtime disabled');
      return;
    }

    if (!window.supabase?.createClient) {
      console.warn('[DASH_REALTIME] Supabase client not loaded');
      return;
    }

    try {
      // Reuse shared singleton to avoid Multiple GoTrueClient warning
      if (window._ngmSupabaseClient) {
        supabaseClient = window._ngmSupabaseClient;
      } else {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        window._ngmSupabaseClient = supabaseClient;
      }
      console.log('[DASH_REALTIME] Supabase client initialized');

      // Subscribe to changes
      subscribeToTasks();
      subscribeToMentions();
    } catch (err) {
      console.error('[DASH_REALTIME] Error initializing:', err);
    }
  }

  // ================================
  // TASKS SUBSCRIPTION
  // ================================

  function subscribeToTasks() {
    if (!supabaseClient) return;

    if (tasksSubscription) {
      tasksSubscription.unsubscribe();
    }

    console.log('[DASH_REALTIME] Subscribing to tasks table...');

    tasksSubscription = supabaseClient
      .channel('dashboard-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          console.log('[DASH_REALTIME] Task change detected:', payload.eventType);
          handleTaskChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[DASH_REALTIME] Tasks subscription status:', status);
        if (status === 'SUBSCRIBED') {
          _taskRetries = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (_taskRetries < MAX_RETRIES) {
            var delay = BACKOFF[_taskRetries] || 60000;
            console.warn('[DASH_REALTIME] Tasks connection lost, retrying in ' + (delay / 1000) + 's...');
            _taskRetries++;
            setTimeout(function () { subscribeToTasks(); }, delay);
          } else {
            console.error('[DASH_REALTIME] Tasks subscription failed after ' + MAX_RETRIES + ' retries');
          }
        }
      });
  }

  // ================================
  // MENTIONS SUBSCRIPTION
  // ================================

  function subscribeToMentions() {
    if (!supabaseClient) return;

    if (mentionsSubscription) {
      mentionsSubscription.unsubscribe();
    }

    console.log('[DASH_REALTIME] Subscribing to mentions table...');

    // Subscribe to messages table for mentions (INSERT + UPDATE for deletes)
    mentionsSubscription = supabaseClient
      .channel('dashboard-mentions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('[DASH_REALTIME] New message detected');
          handleMentionChange(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          handleMentionUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log('[DASH_REALTIME] Mentions subscription status:', status);
        if (status === 'SUBSCRIBED') {
          _mentionRetries = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (_mentionRetries < MAX_RETRIES) {
            var delay = BACKOFF[_mentionRetries] || 60000;
            console.warn('[DASH_REALTIME] Mentions connection lost, retrying in ' + (delay / 1000) + 's...');
            _mentionRetries++;
            setTimeout(function () { subscribeToMentions(); }, delay);
          } else {
            console.error('[DASH_REALTIME] Mentions subscription failed after ' + MAX_RETRIES + ' retries');
          }
        }
      });
  }

  // ================================
  // HANDLE TASK CHANGES
  // ================================

  function handleTaskChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    const currentUserId = getCurrentUserId();

    if (!currentUserId) {
      console.log('[DASH_REALTIME] No current user, skipping update');
      return;
    }

    // Check if this change affects the current user
    const isRelevant = isTaskRelevantToUser(newRecord || oldRecord, currentUserId);

    if (isRelevant || eventType === 'DELETE') {
      console.log('[DASH_REALTIME] Refreshing dashboard data...');

      // Debounce rapid updates
      debounceRefresh('tasks', () => {
        refreshMyWork();
        refreshPendingReviews();
      }, 500);
    }
  }

  function isTaskRelevantToUser(task, userId) {
    if (!task || !userId) return false;

    // Check if user is owner
    if (task.Owner_id === userId) return true;

    // Check if user is in collaborators
    if (task.collaborators_ids && task.collaborators_ids.includes(userId)) return true;
    if (task.Colaborators_id === userId) return true;

    // Check if user is manager
    if (task.managers_ids && task.managers_ids.includes(userId)) return true;
    if (task.manager === userId) return true;

    return false;
  }

  // ================================
  // HANDLE MENTION CHANGES
  // ================================

  // Cached regex — built once per username, reused across all realtime events
  var _mentionRe = null;
  var _mentionReUser = null;

  function _contentMentionsUser(content) {
    if (!content) return false;
    var user = getCurrentUser();
    if (!user || !user.user_name) return false;

    // Build regex once, cache it (invalidate if username changes)
    if (!_mentionRe || _mentionReUser !== user.user_name) {
      var name = user.user_name;
      var nameNoSpaces = name.replace(/\s+/g, '');
      _mentionRe = nameNoSpaces !== name
        ? new RegExp('@(' + _escapeRe(nameNoSpaces) + '|' + _escapeRe(name) + ')\\b', 'i')
        : new RegExp('@' + _escapeRe(name) + '\\b', 'i');
      _mentionReUser = user.user_name;
    }
    return _mentionRe.test(content);
  }

  function _escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function handleMentionChange(payload) {
    var newRecord = payload.new;
    var currentUserId = getCurrentUserId();

    if (!currentUserId || !newRecord) return;

    // Skip own messages
    if (newRecord.user_id === currentUserId) return;

    // Check if current user is mentioned by scanning message content
    if (_contentMentionsUser(newRecord.content)) {
      console.log('[DASH_REALTIME] User was mentioned, refreshing mentions...');

      debounceRefresh('mentions', function() {
        refreshMentions();
        if (window.Toast) {
          Toast.info('New Mention', 'You were mentioned in a message');
        }
      }, 500);
    }
  }

  function handleMentionUpdate(payload) {
    var newRecord = payload.new;
    if (!newRecord) return;

    // When a message is soft-deleted, refresh mentions to remove it
    if (newRecord.is_deleted) {
      debounceRefresh('mentions', function() {
        refreshMentions();
      }, 500);
    }
  }

  // ================================
  // REFRESH FUNCTIONS
  // ================================

  function refreshMyWork() {
    const user = getCurrentUser();
    if (user && typeof window.loadMyWorkTasks === 'function') {
      console.log('[DASH_REALTIME] Refreshing My Work...');
      window.loadMyWorkTasks(user);
    }
  }

  function refreshPendingReviews() {
    const user = getCurrentUser();
    if (user && typeof window.loadPendingReviews === 'function') {
      console.log('[DASH_REALTIME] Refreshing Pending Reviews...');
      window.loadPendingReviews(user);
    }
  }

  function refreshMentions() {
    const user = getCurrentUser();
    if (user && typeof window.loadMentions === 'function') {
      console.log('[DASH_REALTIME] Refreshing Mentions...');
      window.loadMentions(user);
    }
  }

  // ================================
  // HELPERS
  // ================================

  function getCurrentUser() {
    // Try to get from global variable first
    if (window.currentUser) return window.currentUser;

    // Fallback to localStorage
    try {
      const rawUser = localStorage.getItem('ngmUser');
      if (rawUser) return JSON.parse(rawUser);
    } catch (e) {
      console.error('[DASH_REALTIME] Error parsing user:', e);
    }
    return null;
  }

  function getCurrentUserId() {
    const user = getCurrentUser();
    return user?.user_id || null;
  }

  // Debounce mechanism to prevent rapid-fire updates
  const debounceTimers = {};

  function debounceRefresh(key, fn, delay) {
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]);
    }
    debounceTimers[key] = setTimeout(() => {
      fn();
      delete debounceTimers[key];
    }, delay);
  }

  // ================================
  // CLEANUP
  // ================================

  function cleanup() {
    if (tasksSubscription) {
      console.log('[DASH_REALTIME] Unsubscribing from tasks...');
      tasksSubscription.unsubscribe();
      tasksSubscription = null;
    }
    if (mentionsSubscription) {
      console.log('[DASH_REALTIME] Unsubscribing from mentions...');
      mentionsSubscription.unsubscribe();
      mentionsSubscription = null;
    }
  }

  // ================================
  // EXPOSE API
  // ================================

  window.Dashboard_Realtime = {
    init,
    cleanup,
    refreshMyWork,
    refreshPendingReviews,
    refreshMentions,
    refreshAll: () => {
      refreshMyWork();
      refreshPendingReviews();
      refreshMentions();
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Delay init to ensure other scripts are ready
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

})();
