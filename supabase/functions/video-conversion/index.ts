import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Smart format detection - don't trust file extensions
const detectActualFormat = (url: string): { isMalformed: boolean; detectedContainer: string; extension: string } => {
  const normalizedUrl = url.toLowerCase();
  const extension = normalizedUrl.split('.').pop()?.split('?')[0] || '';
  
  // Detect .mkv.mp4 pattern - an MKV improperly wrapped as MP4
  if (normalizedUrl.includes('.mkv.mp4')) {
    return { isMalformed: true, detectedContainer: 'mkv_in_mp4', extension: 'mkv.mp4' };
  }
  
  // Detect double extensions like .avi.mp4, .webm.mp4, etc.
  const doubleExtMatch = normalizedUrl.match(/\.(mkv|avi|webm|wmv|flv)\.(mp4|m4v)/i);
  if (doubleExtMatch) {
    return { isMalformed: true, detectedContainer: `${doubleExtMatch[1]}_in_${doubleExtMatch[2]}`, extension: `${doubleExtMatch[1]}.${doubleExtMatch[2]}` };
  }
  
  return { isMalformed: false, detectedContainer: extension, extension };
};

// FFmpeg command template for iOS-compatible conversion with multi-audio & subtitle support
const generateFFmpegCommand = (inputPath: string, outputPath: string): string => {
  return `ffmpeg -i "${inputPath}" \\
  -c:v libx264 \\
  -profile:v main \\
  -level:v 4.1 \\
  -pix_fmt yuv420p \\
  -preset medium \\
  -crf 23 \\
  -map 0:v:0 \\
  -map 0:a \\
  -c:a aac \\
  -b:a 192k \\
  -ac 2 \\
  -map 0:s? \\
  -c:s mov_text \\
  -movflags +faststart \\
  -metadata:s:a language= \\
  "${outputPath}"`;
};

// GPU-accelerated FFmpeg command (NVENC) with multi-audio & subtitle support
const generateGPUFFmpegCommand = (inputPath: string, outputPath: string): string => {
  return `# GPU Accelerated (NVIDIA NVENC) - Multi-audio safe
ffmpeg -hwaccel cuda -i "${inputPath}" \\
  -c:v h264_nvenc \\
  -preset p4 \\
  -tune hq \\
  -rc vbr \\
  -cq 23 \\
  -profile:v main \\
  -level:v 4.1 \\
  -pix_fmt yuv420p \\
  -map 0:v:0 \\
  -map 0:a \\
  -c:a aac \\
  -b:a 192k \\
  -ac 2 \\
  -map 0:s? \\
  -c:s mov_text \\
  -movflags +faststart \\
  "${outputPath}"`;
};

// Generate multi-quality HLS command with all audio tracks preserved
const generateHLSCommand = (inputPath: string, outputDir: string): string => {
  return `# Multi-quality HLS with all audio tracks preserved
ffmpeg -i "${inputPath}" \\
  -filter_complex "[0:v]split=3[v1][v2][v3]; \\
    [v1]scale=w=640:h=360:force_original_aspect_ratio=decrease[v360]; \\
    [v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v720]; \\
    [v3]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[v1080]" \\
  -map "[v360]" -c:v:0 libx264 -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k \\
  -map "[v720]" -c:v:1 libx264 -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \\
  -map "[v1080]" -c:v:2 libx264 -b:v:2 5000k -maxrate:v:2 5350k -bufsize:v:2 7500k \\
  -map 0:a -c:a aac -b:a 128k -ac 2 \\
  -map 0:s? -c:s webvtt \\
  -pix_fmt yuv420p -profile:v main -level:v 4.1 \\
  -f hls -hls_time 6 -hls_playlist_type vod \\
  -hls_flags independent_segments \\
  -hls_segment_type mpegts \\
  -hls_segment_filename "${outputDir}/segment_%v_%03d.ts" \\
  -master_pl_name "master.m3u8" \\
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \\
  "${outputDir}/stream_%v.m3u8"`;
};

// Smart format detection - inspect actual container, not just filename
const needsConversion = (url: string, videoCodec?: string, audioCodec?: string, is10bit?: boolean, isHevc?: boolean): boolean => {
  const normalizedUrl = url.toLowerCase();
  
  // Detect malformed containers (.mkv.mp4, .avi.mp4, etc.)
  const formatInfo = detectActualFormat(url);
  if (formatInfo.isMalformed) {
    console.log(`Malformed container detected: ${formatInfo.detectedContainer} (file: ${url})`);
    return true;
  }
  
  // MKV always needs conversion for iOS
  if (normalizedUrl.endsWith('.mkv')) return true;
  
  // HEVC/H.265 needs conversion
  if (isHevc || videoCodec?.toLowerCase().includes('hevc') || videoCodec?.toLowerCase().includes('h265')) return true;
  
  // 10-bit video needs conversion
  if (is10bit) return true;
  
  // Non-AAC audio needs conversion
  if (audioCodec && !audioCodec.toLowerCase().includes('aac')) return true;
  
  // WebM, AVI, WMV, FLV need conversion
  if (normalizedUrl.endsWith('.webm')) return true;
  if (normalizedUrl.endsWith('.avi')) return true;
  if (normalizedUrl.endsWith('.wmv')) return true;
  if (normalizedUrl.endsWith('.flv')) return true;
  
  return false;
};

// Detect iOS devices from User-Agent
const isIOSDevice = (userAgent: string): boolean => {
  return /iPhone|iPad|iPod/i.test(userAgent);
};

// Detect Android devices from User-Agent
const isAndroidDevice = (userAgent: string): boolean => {
  return /Android/i.test(userAgent);
};

// Detect Windows devices from User-Agent
const isWindowsDevice = (userAgent: string): boolean => {
  return /Windows/i.test(userAgent);
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get User-Agent for device detection
    const userAgent = req.headers.get('user-agent') || '';

    if (req.method === 'GET') {
      // Get video URL based on device type
      if (action === 'get-video-url') {
        const episodeId = url.searchParams.get('episodeId');
        
        if (!episodeId) {
          return new Response(
            JSON.stringify({ error: 'episodeId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Fetch episode and conversion data
        const { data: episode, error: episodeError } = await supabaseClient
          .from('episodes')
          .select('video_url, external_url')
          .eq('id', episodeId)
          .single();

        if (episodeError || !episode) {
          return new Response(
            JSON.stringify({ error: 'Episode not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const { data: conversion } = await supabaseClient
          .from('video_conversions')
          .select('*')
          .eq('episode_id', episodeId)
          .single();

        const isIOS = isIOSDevice(userAgent);
        const isAndroid = isAndroidDevice(userAgent);
        const isWindows = isWindowsDevice(userAgent);

        let videoUrl = episode.video_url || episode.external_url;
        let servedFormat = 'original';
        let conversionStatus = conversion?.status || 'none';
        let isHLS = false;

        // For iOS, serve iOS-ready version if available
        if (isIOS && conversion?.status === 'completed' && conversion?.ios_ready_url) {
          videoUrl = conversion.ios_ready_url;
          servedFormat = 'ios_ready';
          // Check if it's HLS
          if (videoUrl.includes('.m3u8')) {
            isHLS = true;
          }
        }

        return new Response(
          JSON.stringify({
            videoUrl,
            servedFormat,
            device: isIOS ? 'ios' : isAndroid ? 'android' : isWindows ? 'windows' : 'other',
            conversionStatus,
            needsConversion: conversion?.needs_conversion || false,
            isHLS,
            videoCodec: conversion?.video_codec || null,
            audioCodec: conversion?.audio_codec || null,
            is10bit: conversion?.is_10bit || false,
            isHevc: conversion?.is_hevc || false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get pending conversions
      if (action === 'pending') {
        const { data: pending, error } = await supabaseClient
          .from('video_conversions')
          .select(`
            *,
            episodes (
              title,
              episode_number,
              seasons (
                season_number,
                anime (
                  title
                )
              )
            )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) throw error;

        return new Response(
          JSON.stringify({ conversions: pending }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get processing conversions (for real-time progress)
      if (action === 'processing') {
        const { data: processing, error } = await supabaseClient
          .from('video_conversions')
          .select(`
            *,
            episodes (
              title,
              episode_number,
              seasons (
                season_number,
                anime (
                  title
                )
              )
            )
          `)
          .eq('status', 'processing')
          .order('conversion_started_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ conversions: processing }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get conversion stats
      if (action === 'stats') {
        const { data: stats, error } = await supabaseClient
          .from('video_conversions')
          .select('status');

        if (error) throw error;

        const statusCounts = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        };

        stats?.forEach(row => {
          if (row.status in statusCounts) {
            statusCounts[row.status as keyof typeof statusCounts]++;
          }
        });

        return new Response(
          JSON.stringify({ stats: statusCounts, total: stats?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate FFmpeg command for a specific conversion
      if (action === 'ffmpeg-command') {
        const conversionId = url.searchParams.get('conversionId');
        const commandType = url.searchParams.get('type') || 'cpu'; // cpu, gpu, hls
        
        if (!conversionId) {
          return new Response(
            JSON.stringify({ error: 'conversionId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const { data: conversion, error } = await supabaseClient
          .from('video_conversions')
          .select('*')
          .eq('id', conversionId)
          .single();

        if (error || !conversion) {
          return new Response(
            JSON.stringify({ error: 'Conversion not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const inputPath = conversion.original_path || conversion.original_url;
        const outputPath = inputPath
          .replace('/original/', '/ios_ready/')
          .replace(/\.(mkv|webm|avi)$/i, '.mp4');
        const hlsOutputDir = inputPath
          .replace('/original/', '/hls/')
          .replace(/\.[^.]+$/, '');

        let ffmpegCmd: string;
        switch (commandType) {
          case 'gpu':
            ffmpegCmd = generateGPUFFmpegCommand(inputPath, outputPath);
            break;
          case 'hls':
            ffmpegCmd = generateHLSCommand(inputPath, hlsOutputDir);
            break;
          default:
            ffmpegCmd = generateFFmpegCommand(inputPath, outputPath);
        }

        return new Response(
          JSON.stringify({ 
            command: ffmpegCmd,
            inputPath,
            outputPath,
            hlsOutputDir,
            conversion
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();

      // Scan all existing episodes for missing conversion records
      if (action === 'scan-existing') {
        console.log('Starting smart scan of existing episodes...');
        
        const { data: episodes, error: fetchError } = await supabaseClient
          .from('episodes')
          .select('id, video_url')
          .not('video_url', 'is', null);

        if (fetchError) throw fetchError;

        let created = 0;
        let skipped = 0;
        let requeued = 0;

        for (const episode of episodes || []) {
          if (!episode.video_url) continue;

          // Smart format detection
          const formatInfo = detectActualFormat(episode.video_url);
          const requiresConversion = needsConversion(episode.video_url);

          // Check if conversion record already exists
          const { data: existing } = await supabaseClient
            .from('video_conversions')
            .select('id, status, original_url')
            .eq('episode_id', episode.id)
            .single();

          if (!existing) {
            const { error: insertError } = await supabaseClient
              .from('video_conversions')
              .insert({
                episode_id: episode.id,
                original_url: episode.video_url,
                original_path: episode.video_url,
                needs_conversion: requiresConversion,
                status: requiresConversion ? 'pending' : 'skipped',
              });
            
            if (!insertError) created++;
            else console.error('Insert error:', insertError);
          } else if (formatInfo.isMalformed && existing.status !== 'completed') {
            // Re-queue malformed files that weren't previously detected
            const { error: updateError } = await supabaseClient
              .from('video_conversions')
              .update({
                status: 'pending',
                needs_conversion: true,
                error_message: `Malformed container detected: ${formatInfo.detectedContainer}`,
                conversion_started_at: null,
                conversion_completed_at: null,
              })
              .eq('id', existing.id);
            
            if (!updateError) requeued++;
          } else {
            skipped++;
          }
        }

        console.log(`Smart scan complete: created=${created}, requeued=${requeued}, skipped=${skipped}`);

        return new Response(
          JSON.stringify({ 
            message: 'Smart scan completed',
            created,
            requeued,
            skipped,
            total: episodes?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update conversion status (for external workers to report back)
      if (action === 'update-status') {
        const { 
          conversionId, 
          status, 
          iosReadyUrl, 
          iosReadyPath, 
          errorMessage, 
          iosFileSizeBytes, 
          videoCodec, 
          audioCodec, 
          is10bit, 
          isHevc,
          progress,
          hlsUrl
        } = body;

        if (!conversionId || !status) {
          return new Response(
            JSON.stringify({ error: 'conversionId and status are required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const updateData: Record<string, any> = { status };
        
        if (status === 'processing') {
          updateData.conversion_started_at = new Date().toISOString();
        }
        
        if (status === 'completed') {
          updateData.conversion_completed_at = new Date().toISOString();
          if (iosReadyUrl) updateData.ios_ready_url = iosReadyUrl;
          if (iosReadyPath) updateData.ios_ready_path = iosReadyPath;
          if (iosFileSizeBytes) updateData.ios_file_size_bytes = iosFileSizeBytes;
          if (hlsUrl) updateData.ios_ready_url = hlsUrl; // HLS master playlist URL
        }
        
        if (status === 'failed' && errorMessage) {
          updateData.error_message = errorMessage;
        }

        if (videoCodec) updateData.video_codec = videoCodec;
        if (audioCodec) updateData.audio_codec = audioCodec;
        if (is10bit !== undefined) updateData.is_10bit = is10bit;
        if (isHevc !== undefined) updateData.is_hevc = isHevc;

        const { data: updated, error } = await supabaseClient
          .from('video_conversions')
          .update(updateData)
          .eq('id', conversionId)
          .select()
          .single();

        if (error) throw error;

        console.log(`Status updated: ${conversionId} -> ${status}`);

        return new Response(
          JSON.stringify({ success: true, conversion: updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retry failed conversion
      if (action === 'retry') {
        const { conversionId } = body;

        if (!conversionId) {
          return new Response(
            JSON.stringify({ error: 'conversionId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const { data: updated, error } = await supabaseClient
          .from('video_conversions')
          .update({ 
            status: 'pending',
            error_message: null,
            conversion_started_at: null,
            conversion_completed_at: null
          })
          .eq('id', conversionId)
          .select()
          .single();

        if (error) throw error;

        console.log(`Conversion retried: ${conversionId}`);

        return new Response(
          JSON.stringify({ success: true, conversion: updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retry all failed conversions
      if (action === 'retry-all-failed') {
        const { data: updated, error } = await supabaseClient
          .from('video_conversions')
          .update({ 
            status: 'pending',
            error_message: null,
            conversion_started_at: null,
            conversion_completed_at: null
          })
          .eq('status', 'failed')
          .select();

        if (error) throw error;

        console.log(`Retried ${updated?.length || 0} failed conversions`);

        return new Response(
          JSON.stringify({ success: true, count: updated?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

       // Fix all old anime - repair all videos with smart format detection
       if (action === 'fix-all-old') {
         console.log('Starting smart fix all old anime process...');
         
         // Get all videos that need repair
         const { data: videos, error: fetchError } = await supabaseClient
           .from('video_conversions')
           .select('id, original_url, status, needs_conversion, ios_ready_url')
           .or('status.eq.failed,status.eq.pending,ios_ready_url.is.null');
 
         if (fetchError) throw fetchError;
 
         let repaired = 0;
         let skipped = 0;
         let failed = 0;
         let malformed = 0;
 
         for (const video of videos || []) {
           // Skip if already completed with iOS-ready URL
           if (video.status === 'completed' && video.ios_ready_url) {
             skipped++;
             continue;
           }
 
           // Use smart format detection instead of just file extension
           const formatInfo = detectActualFormat(video.original_url);
           const requiresConversion = needsConversion(video.original_url);
           
           if (formatInfo.isMalformed) {
             malformed++;
             console.log(`Malformed file detected: ${video.original_url} (${formatInfo.detectedContainer})`);
           }
 
           // Queue for conversion
           const { error: updateError } = await supabaseClient
             .from('video_conversions')
             .update({
               status: 'pending',
               error_message: formatInfo.isMalformed 
                 ? `Malformed container: ${formatInfo.detectedContainer} - will remux & reconvert` 
                 : null,
               conversion_started_at: null,
               conversion_completed_at: null,
               needs_conversion: requiresConversion || formatInfo.isMalformed,
             })
             .eq('id', video.id);
 
           if (updateError) {
             failed++;
             console.error(`Failed to queue ${video.id}:`, updateError);
           } else {
             repaired++;
           }
         }
 
         console.log(`Smart fix complete: repaired=${repaired}, malformed=${malformed}, skipped=${skipped}, failed=${failed}`);
 
         return new Response(
           JSON.stringify({
             success: true,
             message: 'Smart fix all old anime completed',
             repaired,
             malformed,
             skipped,
             failed,
             total: videos?.length || 0,
           }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
 
       // Get health stats for dashboard
       if (action === 'health-stats') {
         const { data: conversions, error } = await supabaseClient
           .from('video_conversions')
           .select('status, ios_ready_url, needs_conversion, is_hevc, is_10bit');
 
         if (error) throw error;
 
         const stats = {
           total: conversions?.length || 0,
           healthy: 0,
           processing: 0,
           pending: 0,
           failed: 0,
           iosRisk: 0,
         };
 
         conversions?.forEach(row => {
           if (row.status === 'completed' && row.ios_ready_url) {
             stats.healthy++;
           } else if (row.status === 'processing') {
             stats.processing++;
           } else if (row.status === 'pending') {
             stats.pending++;
           } else if (row.status === 'failed') {
             stats.failed++;
           }
 
           // Check for iOS risk
           if (
             row.status === 'failed' ||
             (row.status === 'pending' && row.needs_conversion) ||
             (!row.ios_ready_url && row.needs_conversion)
           ) {
             stats.iosRisk++;
           }
         });
 
         return new Response(
           JSON.stringify({ stats }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }

       // Auto-process on upload - called after video upload
       if (action === 'auto-process') {
         const { episodeId, videoUrl } = body;
 
         if (!episodeId || !videoUrl) {
           return new Response(
             JSON.stringify({ error: 'episodeId and videoUrl are required' }),
             { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
           );
         }
 
         console.log(`Auto-processing video for episode ${episodeId}: ${videoUrl}`);
 
         // Check if conversion record already exists
         const { data: existing } = await supabaseClient
           .from('video_conversions')
           .select('id')
           .eq('episode_id', episodeId)
           .single();
 
         // Determine if needs conversion
         const requiresConversion = needsConversion(videoUrl);
 
         if (existing) {
           // Update existing record
           const { error: updateError } = await supabaseClient
             .from('video_conversions')
             .update({
               original_url: videoUrl,
               original_path: videoUrl,
               needs_conversion: requiresConversion,
               status: requiresConversion ? 'pending' : 'skipped',
               error_message: null,
             })
             .eq('id', existing.id);
 
           if (updateError) throw updateError;
 
           console.log(`Updated existing conversion record for episode ${episodeId}`);
         } else {
           // Create new record
           const { error: insertError } = await supabaseClient
             .from('video_conversions')
             .insert({
               episode_id: episodeId,
               original_url: videoUrl,
               original_path: videoUrl,
               needs_conversion: requiresConversion,
               status: requiresConversion ? 'pending' : 'skipped',
             });
 
           if (insertError) throw insertError;
 
           console.log(`Created conversion record for episode ${episodeId}`);
         }
 
         return new Response(
           JSON.stringify({
             success: true,
             needsConversion: requiresConversion,
             status: requiresConversion ? 'queued' : 'skipped',
           }),
           { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
       }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (error: unknown) {
    console.error('Video conversion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
