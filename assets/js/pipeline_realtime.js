// assets/js/pipeline_realtime.js
// Supabase Realtime subscription for Pipeline Manager
// Enables live updates when tasks are modified from Dashboard or other sources

(function() {
  'use strict';

  let supabaseClient = null;
  let tasksSubscription = null;

  // ================================
  // INITIALIZATION
  // ================================

  function init() {
    const supabaseUrl = window.SUPABASE_URL || window.NGM_CONFIG?.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_ANON_KEY || window.NGM_CONFIG?.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[PM_REALTIME] Supabase config not found, realtime disabled');
      return;
    }

    if (!window.supabase?.createClient) {
      console.warn('[PM_REALTIME] Supabase client not loaded');
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      console.log('[PM_REALTIME] Supabase client initialized');

      // Subscribe to tasks table changes
      subscribeToTasks();
    } catch (err) {
      console.error('[PM_REALTIME] Error initializing:', err);
    }
  }

  // ================================
  // TASKS SUBSCRIPTION
  // ================================

  function subscribeToTasks() {
    if (!supabaseClient) return;

    // Unsubscribe from previous subscription if exists
    if (tasksSubscription) {
      tasksSubscription.unsubscribe();
    }

    console.log('[PM_REALTIME] Subscribing to tasks table...');

    tasksSubscription = supabaseClient
      .channel('pipeline-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          console.log('[PM_REALTIME] Task change detected:', payload.eventType, payload);
          handleTaskChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[PM_REALTIME] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('[PM_REALTIME] Successfully subscribed to tasks changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[PM_REALTIME] Subscription error');
        }
      });
  }

  // ================================
  // HANDLE CHANGES
  // ================================

  function handleTaskChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        console.log('[PM_REALTIME] New task inserted:', newRecord?.task_id);
        refreshPipeline();
        break;

      case 'UPDATE':
        console.log('[PM_REALTIME] Task updated:', newRecord?.task_id);
        // Check if status changed
        if (oldRecord?.task_status !== newRecord?.task_status) {
          console.log('[PM_REALTIME] Status changed, refreshing pipeline');
          refreshPipeline();
        } else {
          // For other updates, try to update just the task row
          updateTaskInPlace(newRecord);
        }
        break;

      case 'DELETE':
        console.log('[PM_REALTIME] Task deleted:', oldRecord?.task_id);
        refreshPipeline();
        break;
    }
  }

  // ================================
  // UPDATE UI
  // ================================

  function refreshPipeline() {
    // Use the global fetchPipeline function if available
    if (typeof window.fetchPipeline === 'function') {
      console.log('[PM_REALTIME] Refreshing pipeline...');
      window.fetchPipeline().catch(err => console.warn('[Pipeline] Refresh failed:', err));
    } else {
      console.warn('[PM_REALTIME] fetchPipeline not available');
    }
  }

  function updateTaskInPlace(taskData) {
    // Try to update just the specific task row without full refresh
    // This is a more efficient approach for minor updates

    if (!taskData?.task_id) {
      refreshPipeline();
      return;
    }

    // Find the task row in the DOM
    const taskRow = document.querySelector(`[data-task-id="${taskData.task_id}"]`);

    if (!taskRow) {
      // Task not visible, might be in a collapsed group - do full refresh
      refreshPipeline();
      return;
    }

    // Update task description if changed
    const descCell = taskRow.querySelector('[data-field="task_description"]');
    if (descCell && taskData.task_description) {
      descCell.textContent = taskData.task_description;
    }

    // Update time_start if changed
    const timeStartCell = taskRow.querySelector('[data-field="time_start"]');
    if (timeStartCell && taskData.time_start) {
      timeStartCell.textContent = formatTime(taskData.time_start);
    }

    // For status changes, always do full refresh (task moves between groups)
    // This is already handled in handleTaskChange

    console.log('[PM_REALTIME] Task updated in place:', taskData.task_id);
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  }

  // ================================
  // CLEANUP
  // ================================

  function cleanup() {
    if (tasksSubscription) {
      console.log('[PM_REALTIME] Unsubscribing from tasks...');
      tasksSubscription.unsubscribe();
      tasksSubscription = null;
    }
  }

  // ================================
  // EXPOSE API
  // ================================

  window.PM_Realtime = {
    init,
    cleanup,
    refresh: refreshPipeline
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, init after a short delay to ensure other scripts are ready
    setTimeout(init, 500);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

})();
