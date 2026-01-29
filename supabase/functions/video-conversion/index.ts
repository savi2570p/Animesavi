import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// FFmpeg command template for iOS-compatible conversion
const generateFFmpegCommand = (inputPath: string, outputPath: string): string => {
  return `ffmpeg -i "${inputPath}" \\
  -c:v libx264 \\
  -profile:v high \\
  -level:v 4.1 \\
  -pix_fmt yuv420p \\
  -preset medium \\
  -crf 23 \\
  -c:a aac \\
  -b:a 192k \\
  -ac 2 \\
  -movflags +faststart \\
  -sn \\
  -map 0:v:0 \\
  -map 0:a:0 \\
  "${outputPath}"`;
};

// Detect if video needs conversion based on file extension and metadata
const needsConversion = (url: string, videoCodec?: string, audioCodec?: string, is10bit?: boolean, isHevc?: boolean): boolean => {
  // MKV always needs conversion for iOS
  if (url.toLowerCase().endsWith('.mkv')) return true;
  
  // HEVC/H.265 needs conversion
  if (isHevc || videoCodec?.toLowerCase().includes('hevc') || videoCodec?.toLowerCase().includes('h265')) return true;
  
  // 10-bit video needs conversion
  if (is10bit) return true;
  
  // Non-AAC audio needs conversion
  if (audioCodec && !audioCodec.toLowerCase().includes('aac')) return true;
  
  // WebM needs conversion
  if (url.toLowerCase().endsWith('.webm')) return true;
  
  // AVI needs conversion
  if (url.toLowerCase().endsWith('.avi')) return true;
  
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

        // For iOS, serve iOS-ready version if available
        if (isIOS && conversion?.status === 'completed' && conversion?.ios_ready_url) {
          videoUrl = conversion.ios_ready_url;
          servedFormat = 'ios_ready';
        }

        return new Response(
          JSON.stringify({
            videoUrl,
            servedFormat,
            device: isIOS ? 'ios' : isAndroid ? 'android' : isWindows ? 'windows' : 'other',
            conversionStatus,
            needsConversion: conversion?.needs_conversion || false,
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

        const ffmpegCmd = generateFFmpegCommand(inputPath, outputPath);

        return new Response(
          JSON.stringify({ 
            command: ffmpegCmd,
            inputPath,
            outputPath,
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
        const { data: episodes, error: fetchError } = await supabaseClient
          .from('episodes')
          .select('id, video_url')
          .not('video_url', 'is', null);

        if (fetchError) throw fetchError;

        let created = 0;
        let skipped = 0;

        for (const episode of episodes || []) {
          if (!episode.video_url) continue;

          // Check if conversion record already exists
          const { data: existing } = await supabaseClient
            .from('video_conversions')
            .select('id')
            .eq('episode_id', episode.id)
            .single();

          if (!existing) {
            const requiresConversion = needsConversion(episode.video_url);
            
            await supabaseClient
              .from('video_conversions')
              .insert({
                episode_id: episode.id,
                original_url: episode.video_url,
                original_path: episode.video_url,
                needs_conversion: requiresConversion,
                status: requiresConversion ? 'pending' : 'skipped',
              });
            
            created++;
          } else {
            skipped++;
          }
        }

        return new Response(
          JSON.stringify({ 
            message: 'Scan completed',
            created,
            skipped,
            total: episodes?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update conversion status (for external workers to report back)
      if (action === 'update-status') {
        const { conversionId, status, iosReadyUrl, iosReadyPath, errorMessage, iosFileSizeBytes, videoCodec, audioCodec, is10bit, isHevc } = body;

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

        return new Response(
          JSON.stringify({ success: true, conversion: updated }),
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
