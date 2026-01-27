// assets/js/receipt-upload.js
// Receipt upload functionality for Supabase Storage

/**
 * SUPABASE CONFIGURATION NEEDED:
 *
 * 1. Create a bucket in Supabase Storage:
 *    - Name: 'expense-receipts'
 *    - Public: false (for security)
 *
 * 2. Set up RLS (Row Level Security) policies:
 *    - Allow authenticated users to upload to their project's folder
 *    - Allow authenticated users to read receipts from their projects
 *
 * 3. Add environment variables to config.js:
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_ANON_KEY: Your Supabase anon/public key
 *
 * 4. Database column:
 *    - Add column 'receipt_url' (TEXT) to your expenses table
 */

(function() {
  'use strict';

  // Supabase configuration
  const SUPABASE_CONFIG = {
    url: window.SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || 'your-anon-key-here',
    bucketName: 'expenses-receipts' // lowercase - matches actual bucket name
  };

  // Allowed file types
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Upload file to Supabase Storage
   * @param {File} file - The file to upload
   * @param {string} expenseId - The expense ID (used if no billId provided)
   * @param {string} projectId - The project ID
   * @param {string} billId - Optional bill ID for grouping receipts by bill
   * @returns {Promise<string>} - The public URL of the uploaded file
   */
  async function uploadReceipt(file, expenseId, projectId, billId = null) {
    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    // Generate unique filename
    // If billId is provided, use it as the identifier (expenses with same bill share receipt)
    // Otherwise, use expenseId for backwards compatibility
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const identifier = billId ? `bill_${billId}` : expenseId;
    const filename = `${identifier}_${timestamp}.${extension}`;
    const filepath = `${projectId}/${filename}`;

    console.log('[RECEIPT] Uploading file:', { filename, filepath, size: file.size, billId });

    // Supabase upload logic
    try {
      const { createClient } = window.supabase || {};
      if (!createClient) {
        throw new Error('Supabase client not loaded. Add Supabase JS library to HTML.');
      }

      const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

      // Upload file
      // upsert: true allows overwriting orphaned/existing files with same name
      const { data, error } = await supabase.storage
        .from(SUPABASE_CONFIG.bucketName)
        .upload(filepath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[RECEIPT] Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(SUPABASE_CONFIG.bucketName)
        .getPublicUrl(filepath);

      console.log('[RECEIPT] Upload successful:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err) {
      console.error('[RECEIPT] Error uploading to Supabase:', err);
      throw err;
    }
  }

  /**
   * Delete receipt from Supabase Storage
   * @param {string} receiptUrl - The URL of the receipt to delete
   * @returns {Promise<void>}
   */
  async function deleteReceipt(receiptUrl) {
    if (!receiptUrl) return;

    console.log('[RECEIPT] Deleting receipt:', receiptUrl);

    // Supabase delete logic
    try {
      const { createClient } = window.supabase || {};
      if (!createClient) return;

      const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

      // Extract filepath from URL
      const filepath = receiptUrl.split(`/${SUPABASE_CONFIG.bucketName}/`)[1];

      const { error } = await supabase.storage
        .from(SUPABASE_CONFIG.bucketName)
        .remove([filepath]);

      if (error) {
        console.error('[RECEIPT] Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log('[RECEIPT] Delete successful');
    } catch (err) {
      console.error('[RECEIPT] Error deleting from Supabase:', err);
      throw err;
    }
  }

  /**
   * Create file input element for drag & drop and click upload
   * @param {Function} onFileSelected - Callback when file is selected
   * @returns {HTMLElement}
   */
  function createFileUploader(onFileSelected) {
    const container = document.createElement('div');
    container.className = 'receipt-uploader';
    container.innerHTML = `
      <input type="file" class="receipt-file-input" accept="${ALLOWED_TYPES.join(',')}" style="display: none;">
      <div class="receipt-drop-zone">
        <div class="receipt-drop-icon">📎</div>
        <div class="receipt-drop-text">
          <span class="receipt-drop-primary">Click to upload or drag and drop</span>
          <span class="receipt-drop-secondary">JPG, PNG, GIF, WebP or PDF (max 5MB)</span>
        </div>
      </div>
    `;

    const fileInput = container.querySelector('.receipt-file-input');
    const dropZone = container.querySelector('.receipt-drop-zone');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) onFileSelected(file);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('receipt-drop-zone--active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('receipt-drop-zone--active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('receipt-drop-zone--active');

      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    });

    return container;
  }

  /**
   * Create receipt preview element
   * @param {string} receiptUrl - The URL of the receipt
   * @param {Function} onDelete - Callback when delete is clicked
   * @param {Function} onReplace - Optional callback when replace is clicked
   * @returns {HTMLElement}
   */
  function createReceiptPreview(receiptUrl, onDelete, onReplace) {
    const container = document.createElement('div');
    container.className = 'receipt-preview';

    // Use generic label instead of actual filename to avoid info disclosure
    const isBlob = receiptUrl.startsWith('blob:');
    const displayName = isBlob ? 'New file selected' : 'Receipt attached';

    // Detect file type from URL or blob URL
    const urlLower = receiptUrl.toLowerCase();
    const isPdf = urlLower.includes('.pdf');
    const isImage = urlLower.includes('.jpg') || urlLower.includes('.jpeg') ||
                    urlLower.includes('.png') || urlLower.includes('.gif') ||
                    urlLower.includes('.webp') || urlLower.startsWith('blob:');

    // Determine icon based on file type
    let fileIcon;
    if (isPdf) {
      fileIcon = '📄';
    } else if (isImage) {
      fileIcon = '🖼️';
    } else {
      fileIcon = '📎';
    }

    // Build preview content with generic label (no filename disclosure)
    const previewContent = `
      <div class="receipt-preview-file">
        <span class="receipt-preview-file-icon">${fileIcon}</span>
        <div class="receipt-preview-file-info">
          <a href="${receiptUrl}" target="_blank" class="receipt-preview-file-link" title="Click to view receipt">
            ${displayName}
          </a>
          <span class="receipt-preview-file-label">Click to view</span>
        </div>
      </div>`;

    // Build action buttons - show both Replace and Delete if onReplace is provided
    let actionButtons;
    if (onReplace) {
      actionButtons = `
        <button type="button" class="receipt-btn receipt-btn--replace" title="Replace receipt">
          🔄 Replace
        </button>
        <button type="button" class="receipt-btn receipt-btn--delete" title="Delete receipt">
          🗑️ Delete
        </button>
      `;
    } else {
      // Fallback to just View and Delete for backwards compatibility
      actionButtons = `
        <a href="${receiptUrl}" target="_blank" class="receipt-btn receipt-btn--view" title="View receipt">
          👁️ View
        </a>
        <button type="button" class="receipt-btn receipt-btn--delete" title="Delete receipt">
          🗑️ Delete
        </button>
      `;
    }

    container.innerHTML = `
      <div class="receipt-preview-content">
        ${previewContent}
      </div>
      <div class="receipt-preview-actions">
        ${actionButtons}
      </div>
    `;

    // Attach event listeners
    const deleteBtn = container.querySelector('.receipt-btn--delete');
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to delete this receipt?')) {
        onDelete();
      }
    });

    // Attach replace listener if provided
    if (onReplace) {
      const replaceBtn = container.querySelector('.receipt-btn--replace');
      replaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onReplace();
      });
    }

    return container;
  }

  // Expose API
  window.ReceiptUpload = {
    upload: uploadReceipt,
    delete: deleteReceipt,
    createUploader: createFileUploader,
    createPreview: createReceiptPreview,
    ALLOWED_TYPES,
    MAX_FILE_SIZE
  };

  console.log('[RECEIPT] Receipt upload module loaded');
})();
