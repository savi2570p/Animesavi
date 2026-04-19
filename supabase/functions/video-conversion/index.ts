import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CompatibilityResult {
  ios_compatible: boolean;
  issues: string[];
  needs_conversion: boolean;
}

const checkUrlPatternCompatibility = (url: string): { isMalformed: boolean; detectedContainer: string } => {
  const normalizedUrl = url.toLowerCase();
  const doubleExtMatch = normalizedUrl.match(/\.(mkv|avi|webm|wmv|flv)\.(mp4|m4v)/i);
  if (doubleExtMatch) {
    return { isMalformed: true, detectedContainer: `${doubleExtMatch[1]}_in_${doubleExtMatch[2]}` };
  }
  return { isMalformed: false, detectedContainer: normalizedUrl.split('.').pop()?.split('?')[0] || 'unknown' };
};

const preliminaryNeedsConversion = (url: string): boolean => {
  const normalized = url.toLowerCase();
  const pattern = checkUrlPatternCompatibility(url);
  if (pattern.isMalformed) return true;
  if (normalized.endsWith('.mkv')) return true;
  if (normalized.endsWith('.webm')) return true;
  if (normalized.endsWith('.avi')) return true;
  if (normalized.endsWith('.wmv')) return true;
  if (normalized.endsWith('.flv')) return true;
  if (normalized.endsWith('.mp4') || normalized.endsWith('.m4v')) {
    return false;
  }
  return true;
};

const isIOSDevice = (ua: string): boolean => /iPhone|iPad|iPod/i.test(ua);
const isAndroidDevice = (ua: string): boolean => /Android/i.test(ua);
const isWindowsDevice = (ua: string): boolean => /Windows/i.test(ua);

// ── Auth helpers ──────────────────────────────────────────────────────────
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, roles: [] as string[] };
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await authClient.auth.getClaims(token);
  if (error || !data?.claims) {
    return { user: null, roles: [] as string[] };
  }

  const userId = data.claims.sub as string;

  // Fetch roles using service role client (bypasses RLS)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data: roleData } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const roles = (roleData || []).map((r: { role: string }) => r.role);
  return { user: { id: userId }, roles };
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
  );
}

function forbiddenResponse(msg = 'Forbidden') {
  return new Response(
    JSON.stringify({ error: msg }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
  );
}

Deno.serve(async (req) => {
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
    const userAgent = req.headers.get('user-agent') || '';

    // ── Determine required auth level per action ──────────────────────────
    const adminOnlyActions = ['scan-existing', 'retry-all-failed', 'fix-all-ios', 'fix-all-old'];
    const uploaderActions = ['auto-process', 'update-status', 'retry'];
    const authenticatedActions = ['pending', 'processing', 'stats', 'ffmpeg-command', 'health-stats'];
    // 'get-video-url' is public (needed for video playback)

    if (action && adminOnlyActions.includes(action)) {
      const { user, roles } = await authenticateUser(req);
      if (!user) return unauthorizedResponse();
      if (!roles.includes('admin')) return forbiddenResponse('Admin access required');
    } else if (action && uploaderActions.includes(action)) {
      const { user, roles } = await authenticateUser(req);
      if (!user) return unauthorizedResponse();
      if (!roles.includes('admin') && !roles.includes('uploader')) return forbiddenResponse('Uploader access required');
    } else if (action && authenticatedActions.includes(action)) {
      const { user } = await authenticateUser(req);
      if (!user) return unauthorizedResponse();
    }
    // get-video-url remains public for video playback

    // ── GET endpoints ─────────────────────────────────────────────────────
    if (req.method === 'GET') {
      
      if (action === 'get-video-url') {
        const episodeId = url.searchParams.get('episodeId');
        if (!episodeId) {
          return new Response(
            JSON.stringify({ error: 'episodeId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const { data: episode, error: episodeError } = await supabaseClient
          .from('episodes').select('video_url, external_url').eq('id', episodeId).single();
        if (episodeError || !episode) {
          return new Response(
            JSON.stringify({ error: 'Episode not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        const { data: conversion } = await supabaseClient
          .from('video_conversions').select('*').eq('episode_id', episodeId).single();

        const isIOS = isIOSDevice(userAgent);
        let videoUrl = episode.video_url || episode.external_url;
        let servedFormat = 'original';
        let conversionStatus = conversion?.status || 'none';

        if (isIOS && conversion) {
          if (conversion.ios_compatible && conversion.ios_ready_url) {
            videoUrl = conversion.ios_ready_url;
            servedFormat = 'ios_ready';
          } else if (conversion.hls_url) {
            videoUrl = conversion.hls_url;
            servedFormat = 'hls';
          } else if (conversion.status === 'completed' && conversion.ios_ready_url) {
            videoUrl = conversion.ios_ready_url;
            servedFormat = 'ios_ready';
          }
        }

        return new Response(
          JSON.stringify({
            videoUrl,
            servedFormat,
            device: isIOS ? 'ios' : isAndroidDevice(userAgent) ? 'android' : isWindowsDevice(userAgent) ? 'windows' : 'other',
            conversionStatus,
            needsConversion: conversion?.needs_conversion || false,
            isHLS: videoUrl?.includes('.m3u8') || false,
            iosCompatible: conversion?.ios_compatible || false,
            videoCodec: conversion?.video_codec || null,
            audioCodec: conversion?.audio_codec || null,
            videoProfile: conversion?.video_profile || null,
            pixelFormat: conversion?.pixel_format || null,
            audioChannels: conversion?.audio_channels || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'pending') {
        const { data: pending, error } = await supabaseClient
          .from('video_conversions')
          .select(`*, episodes (title, episode_number, seasons (season_number, anime (title)))`)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(100);
        if (error) throw error;
        return new Response(
          JSON.stringify({ conversions: pending }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'processing') {
        const { data: processing, error } = await supabaseClient
          .from('video_conversions')
          .select(`*, episodes (title, episode_number, seasons (season_number, anime (title)))`)
          .eq('status', 'processing')
          .order('conversion_started_at', { ascending: false });
        if (error) throw error;
        return new Response(
          JSON.stringify({ conversions: processing }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'stats') {
        const { data: stats, error } = await supabaseClient
          .from('video_conversions').select('status');
        if (error) throw error;
        const counts: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
        stats?.forEach(r => { if (r.status in counts) counts[r.status]++; });
        return new Response(
          JSON.stringify({ stats: counts, total: stats?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'ffmpeg-command') {
        const conversionId = url.searchParams.get('conversionId');
        const commandType = url.searchParams.get('type') || 'cpu';
        if (!conversionId) {
          return new Response(
            JSON.stringify({ error: 'conversionId is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        const { data: conversion, error } = await supabaseClient
          .from('video_conversions').select('*').eq('id', conversionId).single();
        if (error || !conversion) {
          return new Response(
            JSON.stringify({ error: 'Conversion not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }
        const inputPath = conversion.original_path || conversion.original_url;
        const outputPath = inputPath.replace('/original/', '/ios_ready/').replace(/\.(mkv|webm|avi)$/i, '.mp4');
        
        let ffmpegCmd: string;
        if (commandType === 'gpu') {
          ffmpegCmd = `ffmpeg -hwaccel cuda -i "${inputPath}" -c:v h264_nvenc -preset p4 -tune hq -rc vbr -cq 22 -profile:v main -level:v 4.1 -pix_fmt yuv420p -map 0:v:0 -map 0:a -c:a aac -b:a 192k -ac 2 -movflags +faststart "${outputPath}"`;
        } else {
          ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -profile:v main -level:v 4.1 -pix_fmt yuv420p -preset fast -crf 22 -map 0:v:0 -map 0:a -c:a aac -b:a 192k -ac 2 -movflags +faststart "${outputPath}"`;
        }
        return new Response(
          JSON.stringify({ command: ffmpegCmd, inputPath, outputPath, conversion }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── POST endpoints ────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'scan-existing') {
        console.log('Starting smart scan of existing episodes (batched)...');
        const batchSize = Math.max(1, Math.min(2000, Number(body?.batchSize) || 500));
        const offset = Math.max(0, Number(body?.offset) || 0);

        // Fetch a single page of episodes
        const { data: episodes, error: fetchError } = await supabaseClient
          .from('episodes')
          .select('id, video_url')
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (fetchError) throw fetchError;

        const epList = episodes || [];
        let created = 0, skipped = 0, requeued = 0;

        if (epList.length > 0) {
          // Bulk-fetch existing conversions for these episodes (1 query)
          const ids = epList.map((e) => e.id);
          const { data: existingRows } = await supabaseClient
            .from('video_conversions')
            .select('id, episode_id, status')
            .in('episode_id', ids);
          const existingMap = new Map<string, { id: string; status: string }>();
          for (const row of existingRows || []) {
            existingMap.set(row.episode_id, { id: row.id, status: row.status });
          }

          const toInsert: any[] = [];
          const toRequeue: string[] = [];
          let requeueReason = '';

          for (const episode of epList) {
            if (!episode.video_url) continue;
            const pattern = checkUrlPatternCompatibility(episode.video_url);
            const requiresConversion = preliminaryNeedsConversion(episode.video_url);
            const existing = existingMap.get(episode.id);

            if (!existing) {
              toInsert.push({
                episode_id: episode.id,
                original_url: episode.video_url,
                original_path: episode.video_url,
                needs_conversion: requiresConversion,
                status: 'pending',
                conversion_stage: 'queued',
              });
            } else if (pattern.isMalformed && existing.status !== 'completed') {
              toRequeue.push(existing.id);
              requeueReason = `Malformed container: ${pattern.detectedContainer}`;
            } else {
              skipped++;
            }
          }

          // Bulk insert new records
          if (toInsert.length > 0) {
            const { error: insertError, count } = await supabaseClient
              .from('video_conversions')
              .insert(toInsert, { count: 'exact' });
            if (!insertError) created = count ?? toInsert.length;
            else console.error('Bulk insert error:', insertError);
          }

          // Bulk requeue
          if (toRequeue.length > 0) {
            const { error: updateError, count } = await supabaseClient
              .from('video_conversions')
              .update({
                status: 'pending',
                needs_conversion: true,
                error_message: requeueReason,
                conversion_started_at: null,
                conversion_completed_at: null,
                conversion_stage: 'queued',
              }, { count: 'exact' })
              .in('id', toRequeue);
            if (!updateError) requeued = count ?? toRequeue.length;
            else console.error('Bulk requeue error:', updateError);
          }
        }

        const hasMore = epList.length === batchSize;
        console.log(`Smart scan batch done: offset=${offset} size=${epList.length} created=${created} requeued=${requeued} skipped=${skipped} hasMore=${hasMore}`);
        return new Response(
          JSON.stringify({
            message: 'Smart scan batch completed',
            created, requeued, skipped,
            processed: epList.length,
            offset,
            nextOffset: hasMore ? offset + batchSize : null,
            hasMore,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'update-status') {
        const { conversionId, status } = body;
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
        }
        if (status === 'failed' && body.errorMessage) {
          updateData.error_message = body.errorMessage;
        }

        const fieldMap: Record<string, string> = {
          iosReadyUrl: 'ios_ready_url',
          iosReadyPath: 'ios_ready_path',
          iosFileSizeBytes: 'ios_file_size_bytes',
          videoCodec: 'video_codec',
          audioCodec: 'audio_codec',
          is10bit: 'is_10bit',
          isHevc: 'is_hevc',
          hlsUrl: 'hls_url',
          conversionStage: 'conversion_stage',
          estimatedSecondsRemaining: 'estimated_seconds_remaining',
          workerId: 'worker_id',
          videoProfile: 'video_profile',
          pixelFormat: 'pixel_format',
          audioChannels: 'audio_channels',
          audioSampleRate: 'audio_sample_rate',
          subtitleFormat: 'subtitle_format',
          containerFormat: 'container_format',
          iosCompatible: 'ios_compatible',
          compatibilityDetails: 'compatibility_details',
          retryCount: 'retry_count',
          progress: 'conversion_progress',
          errorMessage: 'error_message',
        };

        for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
          if (body[bodyKey] !== undefined) {
            updateData[dbKey] = body[bodyKey];
          }
        }

        const { data: updated, error } = await supabaseClient
          .from('video_conversions').update(updateData).eq('id', conversionId).select().single();
        if (error) throw error;

        console.log(`Status updated: ${conversionId} -> ${status}`);
        return new Response(
          JSON.stringify({ success: true, conversion: updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          .update({ status: 'pending', error_message: null, conversion_started_at: null, conversion_completed_at: null, conversion_stage: 'queued', conversion_progress: 0 })
          .eq('id', conversionId).select().single();
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, conversion: updated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'retry-all-failed') {
        const { data: updated, error } = await supabaseClient
          .from('video_conversions')
          .update({ status: 'pending', error_message: null, conversion_started_at: null, conversion_completed_at: null, conversion_stage: 'queued', conversion_progress: 0 })
          .eq('status', 'failed').select();
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, count: updated?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'fix-all-ios') {
        console.log('Starting global iOS fix...');
        const { data: videos, error: fetchError } = await supabaseClient
          .from('video_conversions')
          .select('id, original_url, status, ios_compatible, needs_conversion, ios_ready_url')
          .or('ios_compatible.is.null,ios_compatible.eq.false,status.eq.failed,status.eq.pending');

        if (fetchError) throw fetchError;

        let queued = 0, skipped = 0;
        for (const video of videos || []) {
          if (video.status === 'completed' && video.ios_compatible === true && video.ios_ready_url) {
            skipped++;
            continue;
          }
          const { error: updateError } = await supabaseClient
            .from('video_conversions')
            .update({
              status: 'pending',
              error_message: null,
              conversion_started_at: null,
              conversion_completed_at: null,
              conversion_stage: 'queued',
              conversion_progress: 0,
              ios_compatible: false,
            })
            .eq('id', video.id);
          if (!updateError) queued++;
        }

        console.log(`Global iOS fix: queued=${queued}, skipped=${skipped}`);
        return new Response(
          JSON.stringify({ success: true, queued, skipped, total: videos?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'fix-all-old') {
        const { data: videos, error: fetchError } = await supabaseClient
          .from('video_conversions')
          .select('id, original_url, status, ios_compatible, ios_ready_url')
          .or('status.eq.failed,status.eq.pending,ios_ready_url.is.null,ios_compatible.is.null,ios_compatible.eq.false');

        if (fetchError) throw fetchError;

        let repaired = 0, skipped = 0;
        for (const video of videos || []) {
          if (video.status === 'completed' && video.ios_compatible === true && video.ios_ready_url) {
            skipped++;
            continue;
          }
          const { error: updateError } = await supabaseClient
            .from('video_conversions')
            .update({
              status: 'pending', error_message: null,
              conversion_started_at: null, conversion_completed_at: null,
              needs_conversion: true, conversion_stage: 'queued', conversion_progress: 0,
            })
            .eq('id', video.id);
          if (!updateError) repaired++;
        }

        return new Response(
          JSON.stringify({ success: true, repaired, skipped, total: videos?.length || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'health-stats') {
        const { data: conversions, error } = await supabaseClient
          .from('video_conversions')
          .select('status, ios_ready_url, needs_conversion, ios_compatible, is_hevc, is_10bit');
        if (error) throw error;

        const stats = { total: conversions?.length || 0, healthy: 0, processing: 0, pending: 0, failed: 0, iosRisk: 0, iosVerified: 0 };
        conversions?.forEach(r => {
          if (r.status === 'completed' && r.ios_compatible) { stats.healthy++; stats.iosVerified++; }
          else if (r.status === 'completed' && r.ios_ready_url) { stats.healthy++; }
          else if (r.status === 'processing') stats.processing++;
          else if (r.status === 'pending') stats.pending++;
          else if (r.status === 'failed') stats.failed++;

          if (r.status === 'failed' || (r.status === 'pending' && r.needs_conversion) || (!r.ios_compatible && r.needs_conversion)) {
            stats.iosRisk++;
          }
        });

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'auto-process') {
        const { episodeId, videoUrl } = body;
        if (!episodeId || !videoUrl) {
          return new Response(
            JSON.stringify({ error: 'episodeId and videoUrl are required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const requiresConversion = preliminaryNeedsConversion(videoUrl);
        const { data: existing } = await supabaseClient
          .from('video_conversions').select('id').eq('episode_id', episodeId).single();

        if (existing) {
          await supabaseClient.from('video_conversions').update({
            original_url: videoUrl, original_path: videoUrl,
            needs_conversion: requiresConversion,
            status: 'pending',
            error_message: null, conversion_stage: 'queued',
            ios_compatible: false,
          }).eq('id', existing.id);
        } else {
          await supabaseClient.from('video_conversions').insert({
            episode_id: episodeId, original_url: videoUrl, original_path: videoUrl,
            needs_conversion: requiresConversion,
            status: 'pending',
            conversion_stage: 'queued',
          });
        }

        return new Response(
          JSON.stringify({ success: true, needsConversion: requiresConversion, status: 'queued' }),
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
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
