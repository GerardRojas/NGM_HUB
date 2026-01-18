// Supabase Bucket Diagnostic Tool
// Run: window.diagBucket() in browser console

(function() {
  'use strict';

  async function diagnoseBucket() {
    console.log('================================');
    console.log('SUPABASE BUCKET DIAGNOSTIC');
    console.log('================================\n');

    // 1. Check Supabase client library
    console.log('1. Checking Supabase client library...');
    if (!window.supabase) {
      console.error('❌ Supabase library not loaded');
      console.log('   Fix: Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> to HTML');
      return;
    }
    console.log('✅ Supabase library loaded');

    const { createClient } = window.supabase;
    if (!createClient) {
      console.error('❌ createClient not available');
      return;
    }
    console.log('✅ createClient available\n');

    // 2. Check configuration
    console.log('2. Checking configuration...');
    const config = {
      url: window.SUPABASE_URL,
      anonKey: window.SUPABASE_ANON_KEY,
      bucketName: 'expenses-receipts' // lowercase - matches actual bucket name
    };

    console.log('   URL:', config.url ? '✅ Set' : '❌ Missing');
    console.log('   Anon Key:', config.anonKey ? '✅ Set' : '❌ Missing');
    console.log('   Bucket Name:', config.bucketName);

    if (!config.url || !config.anonKey) {
      console.error('❌ Missing Supabase credentials');
      console.log('   Fix: Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js');
      return;
    }
    console.log('✅ Configuration complete\n');

    // 3. Initialize client
    console.log('3. Initializing Supabase client...');
    let supabase;
    try {
      supabase = createClient(config.url, config.anonKey);
      console.log('✅ Client initialized\n');
    } catch (error) {
      console.error('❌ Failed to initialize client:', error.message);
      return;
    }

    // 4. List all buckets
    console.log('4. Listing all storage buckets...');
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        console.error('❌ Error listing buckets:', error.message);
        console.log('   Error details:', error);
        return;
      }

      if (!buckets || buckets.length === 0) {
        console.warn('⚠️  No buckets found');
        console.log('   Create bucket in Supabase Dashboard:');
        console.log('   1. Go to Storage section');
        console.log('   2. Click "New bucket"');
        console.log('   3. Name: "expenses-receipts"');
        console.log('   4. Make it PUBLIC (important!)');
        return;
      }

      console.log('✅ Found', buckets.length, 'bucket(s):');
      buckets.forEach(bucket => {
        console.log(`   - ${bucket.name} (${bucket.public ? 'PUBLIC' : 'PRIVATE'}) [ID: ${bucket.id}]`);
      });
      console.log('');

      // 5. Check if target bucket exists
      console.log('5. Checking target bucket:', config.bucketName);
      const targetBucket = buckets.find(b => b.name === config.bucketName);

      if (!targetBucket) {
        console.error('❌ Bucket "' + config.bucketName + '" does not exist');
        console.log('   Available buckets:', buckets.map(b => b.name).join(', '));
        console.log('\n   To fix:');
        console.log('   1. Go to Supabase Dashboard → Storage');
        console.log('   2. Click "New bucket"');
        console.log('   3. Name: "expenses-receipts"');
        console.log('   4. Set as PUBLIC');
        console.log('   5. Click "Create bucket"');
        return;
      }

      console.log('✅ Bucket exists');
      console.log('   Name:', targetBucket.name);
      console.log('   Public:', targetBucket.public ? 'Yes ✅' : 'No ❌');
      console.log('   ID:', targetBucket.id);
      console.log('   Created:', targetBucket.created_at);

      if (!targetBucket.public) {
        console.warn('\n⚠️  WARNING: Bucket is PRIVATE');
        console.log('   Receipts won\'t be accessible via public URLs');
        console.log('   To fix:');
        console.log('   1. Go to Supabase Dashboard → Storage');
        console.log('   2. Click on "expenses-receipts"');
        console.log('   3. Go to Settings');
        console.log('   4. Toggle "Public bucket" to ON');
      }
      console.log('');

      // 6. Test upload permissions
      console.log('6. Testing upload permissions...');
      const testFilename = `test-${Date.now()}.txt`;
      const testContent = new Blob(['Test upload from diagnostic'], { type: 'text/plain' });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(config.bucketName)
        .upload(testFilename, testContent);

      if (uploadError) {
        console.error('❌ Upload test failed:', uploadError.message);
        console.log('   Error details:', uploadError);

        if (uploadError.message.includes('row-level security')) {
          console.log('\n   RLS Policy Issue:');
          console.log('   1. Go to Supabase Dashboard → Storage → ' + config.bucketName);
          console.log('   2. Click "Policies"');
          console.log('   3. Add policy: Allow authenticated users to upload');
          console.log('   4. SQL: (bucket_id = \'expenses-receipts\')');
        }
        return;
      }

      console.log('✅ Upload successful:', uploadData.path);

      // 7. Test public URL generation
      console.log('\n7. Testing public URL generation...');
      const { data: urlData } = supabase.storage
        .from(config.bucketName)
        .getPublicUrl(testFilename);

      console.log('✅ Public URL:', urlData.publicUrl);

      // 8. Clean up test file
      console.log('\n8. Cleaning up test file...');
      const { error: deleteError } = await supabase.storage
        .from(config.bucketName)
        .remove([testFilename]);

      if (deleteError) {
        console.warn('⚠️  Could not delete test file:', deleteError.message);
      } else {
        console.log('✅ Test file deleted');
      }

    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      console.log('   Stack:', error.stack);
    }

    console.log('\n================================');
    console.log('DIAGNOSTIC COMPLETE');
    console.log('================================');
  }

  // Expose to window
  window.diagBucket = diagnoseBucket;

  console.log('[SUPABASE DIAGNOSTIC] Loaded. Run window.diagBucket() to test bucket configuration.');
})();
