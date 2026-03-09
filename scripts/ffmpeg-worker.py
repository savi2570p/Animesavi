#!/usr/bin/env python3
"""
Production-Grade FFmpeg Video Conversion Worker
=================================================
Smart processing, parallel jobs, error recovery, HLS generation,
resource protection, and real-time progress tracking.

Usage:
    python ffmpeg-worker.py [--gpu] [--max-concurrent=4] [--poll-interval=15]

Environment Variables Required:
    SUPABASE_URL        - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key
    STORAGE_BASE_PATH   - Base path for video storage (e.g., /mnt/videos)
    CDN_BASE_URL        - Base URL for CDN delivery (e.g., https://cdn.example.com)
"""

import os
import sys
import json
import time
import signal
import shutil
import argparse
import subprocess
import threading
import psutil  # pip install psutil
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Configuration ──────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
STORAGE_BASE_PATH = os.getenv('STORAGE_BASE_PATH', '/mnt/videos')
CDN_BASE_URL = os.getenv('CDN_BASE_URL', 'https://your-cdn.com')
EDGE_FUNCTION_URL = f"{SUPABASE_URL}/functions/v1/video-conversion"

# Resource limits
MAX_CPU_PERCENT = 85
MAX_MEMORY_PERCENT = 85
TEMP_CLEANUP_AGE_HOURS = 24

# Worker state
shutdown_event = threading.Event()
pause_event = threading.Event()
worker_id = f"{os.uname().nodename}-{os.getpid()}"
active_jobs = threading.Semaphore(1)  # Will be re-set in main()


# ── Logging ────────────────────────────────────────────────────────────────────
def log(message: str, level: str = 'INFO'):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] [{level}] [{worker_id}] {message}", flush=True)


# ── API helpers ────────────────────────────────────────────────────────────────
def api_headers():
    return {
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }


def update_status(conversion_id: str, status: str, **kwargs):
    payload: Dict[str, Any] = {
        'conversionId': conversion_id,
        'status': status,
    }
    field_map = {
        'ios_ready_url': 'iosReadyUrl',
        'ios_ready_path': 'iosReadyPath',
        'error_message': 'errorMessage',
        'ios_file_size_bytes': 'iosFileSizeBytes',
        'video_codec': 'videoCodec',
        'audio_codec': 'audioCodec',
        'is_10bit': 'is10bit',
        'is_hevc': 'isHevc',
        'progress': 'progress',
        'hls_url': 'hlsUrl',
        'conversion_stage': 'conversionStage',
        'estimated_seconds_remaining': 'estimatedSecondsRemaining',
        'worker_id': 'workerId',
        'video_profile': 'videoProfile',
        'pixel_format': 'pixelFormat',
        'audio_channels': 'audioChannels',
        'audio_sample_rate': 'audioSampleRate',
        'subtitle_format': 'subtitleFormat',
        'container_format': 'containerFormat',
        'ios_compatible': 'iosCompatible',
        'compatibility_details': 'compatibilityDetails',
        'retry_count': 'retryCount',
    }
    for k, v in kwargs.items():
        if k in field_map and v is not None:
            payload[field_map[k]] = v

    try:
        r = requests.post(
            f"{EDGE_FUNCTION_URL}?action=update-status",
            headers=api_headers(), json=payload, timeout=15
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log(f"Status update failed for {conversion_id}: {e}", 'ERROR')
        return None


def get_pending_conversions() -> list:
    try:
        r = requests.get(
            f"{EDGE_FUNCTION_URL}?action=pending",
            headers=api_headers(), timeout=15
        )
        r.raise_for_status()
        return r.json().get('conversions', [])
    except Exception as e:
        log(f"Fetch pending failed: {e}", 'ERROR')
        return []


# ── Video analysis ─────────────────────────────────────────────────────────────
def probe_video(input_file: str) -> Dict[str, Any]:
    """Full ffprobe analysis returning streams + format."""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_streams', '-show_format', input_file
        ], capture_output=True, text=True, timeout=60)
        return json.loads(result.stdout)
    except Exception as e:
        log(f"ffprobe error: {e}", 'ERROR')
        return {}


def analyze_compatibility(probe_data: Dict) -> Dict[str, Any]:
    """Strict iOS compatibility analysis based on actual codec inspection."""
    info: Dict[str, Any] = {
        'container_format': None,
        'video_codec': None,
        'video_profile': None,
        'pixel_format': None,
        'audio_codec': None,
        'audio_channels': None,
        'audio_sample_rate': None,
        'subtitle_format': None,
        'is_10bit': False,
        'is_hevc': False,
        'duration_seconds': 0,
        'ios_compatible': False,
        'issues': [],
    }

    # Container
    fmt = probe_data.get('format', {})
    info['container_format'] = fmt.get('format_name', 'unknown')
    try:
        info['duration_seconds'] = float(fmt.get('duration', 0))
    except (ValueError, TypeError):
        pass

    for stream in probe_data.get('streams', []):
        codec_type = stream.get('codec_type')
        if codec_type == 'video' and info['video_codec'] is None:
            info['video_codec'] = stream.get('codec_name', 'unknown')
            info['video_profile'] = stream.get('profile', 'unknown')
            info['pixel_format'] = stream.get('pix_fmt', 'unknown')
            info['is_10bit'] = '10' in str(info['pixel_format'])
            info['is_hevc'] = info['video_codec'].lower() in ('hevc', 'h265')
        elif codec_type == 'audio' and info['audio_codec'] is None:
            info['audio_codec'] = stream.get('codec_name', 'unknown')
            info['audio_channels'] = stream.get('channels', 0)
            try:
                info['audio_sample_rate'] = int(stream.get('sample_rate', 0))
            except (ValueError, TypeError):
                info['audio_sample_rate'] = 0
        elif codec_type == 'subtitle' and info['subtitle_format'] is None:
            info['subtitle_format'] = stream.get('codec_name', 'unknown')

    # ── Strict iOS rules ──
    issues = []
    vc = (info['video_codec'] or '').lower()
    if vc != 'h264':
        issues.append(f"Video codec '{info['video_codec']}' is not H.264")
    vp = (info['video_profile'] or '').lower()
    if vp not in ('main', 'baseline', 'constrained baseline'):
        issues.append(f"Video profile '{info['video_profile']}' is not Main/Baseline")
    if info['pixel_format'] != 'yuv420p':
        issues.append(f"Pixel format '{info['pixel_format']}' is not yuv420p")
    ac = (info['audio_codec'] or '').lower()
    if ac != 'aac':
        issues.append(f"Audio codec '{info['audio_codec']}' is not AAC")
    if info['audio_channels'] and info['audio_channels'] > 2:
        issues.append(f"Audio has {info['audio_channels']} channels (need stereo)")
    if info['audio_sample_rate'] and info['audio_sample_rate'] not in (44100, 48000):
        issues.append(f"Sample rate {info['audio_sample_rate']}Hz not standard")

    # Container check
    container = (info['container_format'] or '').lower()
    if 'mp4' not in container and 'mov' not in container and 'm4v' not in container:
        issues.append(f"Container '{container}' is not MP4/MOV")

    info['issues'] = issues
    info['ios_compatible'] = len(issues) == 0
    return info


def needs_video_reencode(info: Dict) -> bool:
    vc = (info.get('video_codec') or '').lower()
    vp = (info.get('video_profile') or '').lower()
    pf = info.get('pixel_format', '')
    if vc != 'h264':
        return True
    if vp not in ('main', 'baseline', 'constrained baseline', 'high'):
        return True
    if pf != 'yuv420p':
        return True
    return False


def needs_audio_reencode(info: Dict) -> bool:
    ac = (info.get('audio_codec') or '').lower()
    ch = info.get('audio_channels', 0)
    if ac != 'aac':
        return True
    if ch and ch > 2:
        return True
    return False


# ── GPU detection ──────────────────────────────────────────────────────────────
def check_gpu_encoder() -> str:
    try:
        result = subprocess.run(['ffmpeg', '-encoders'], capture_output=True, text=True, timeout=10)
        out = result.stdout
        if 'h264_nvenc' in out:
            return 'nvenc'
        if 'h264_videotoolbox' in out:
            return 'videotoolbox'
        if 'h264_vaapi' in out:
            return 'vaapi'
    except Exception:
        pass
    return 'cpu'


def get_encoder_config(use_gpu: bool) -> Tuple[str, List[str]]:
    if not use_gpu:
        return 'libx264', ['-preset', 'fast', '-crf', '22']  # fast preset for speed

    gpu = check_gpu_encoder()
    if gpu == 'nvenc':
        log("Using NVIDIA NVENC")
        return 'h264_nvenc', ['-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '22']
    elif gpu == 'videotoolbox':
        log("Using Apple VideoToolbox")
        return 'h264_videotoolbox', ['-q:v', '60']
    elif gpu == 'vaapi':
        log("Using Intel VAAPI")
        return 'h264_vaapi', ['-vaapi_device', '/dev/dri/renderD128']
    else:
        return 'libx264', ['-preset', 'fast', '-crf', '22']


# ── Resource protection ───────────────────────────────────────────────────────
def system_overloaded() -> bool:
    cpu = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory().percent
    if cpu > MAX_CPU_PERCENT:
        log(f"CPU overloaded: {cpu}%", 'WARN')
        return True
    if mem > MAX_MEMORY_PERCENT:
        log(f"Memory overloaded: {mem}%", 'WARN')
        return True
    return False


def cleanup_temp_files():
    """Remove old temp/partial files."""
    temp_dir = Path(STORAGE_BASE_PATH) / 'temp'
    if not temp_dir.exists():
        return
    cutoff = time.time() - (TEMP_CLEANUP_AGE_HOURS * 3600)
    cleaned = 0
    for f in temp_dir.iterdir():
        if f.stat().st_mtime < cutoff:
            try:
                f.unlink()
                cleaned += 1
            except Exception:
                pass
    if cleaned:
        log(f"Cleaned {cleaned} temp files")


# ── Smart conversion ──────────────────────────────────────────────────────────
def smart_convert(input_file: str, output_file: str, info: Dict,
                  use_gpu: bool, conversion_id: str) -> bool:
    """
    Smart conversion: only re-encode streams that are incompatible.
    - If video is already H.264/yuv420p → copy video stream
    - If audio is already AAC stereo → copy audio stream
    - Only remux container if everything is compatible
    """
    encoder, encoder_opts = get_encoder_config(use_gpu)
    reencode_video = needs_video_reencode(info)
    reencode_audio = needs_audio_reencode(info)
    duration = info.get('duration_seconds', 0)

    mode = 'full' if (reencode_video and reencode_audio) else \
           'video-only' if reencode_video else \
           'audio-only' if reencode_audio else 'remux'

    log(f"Smart mode: {mode} (video={reencode_video}, audio={reencode_audio})")

    update_status(conversion_id, 'processing',
                  conversion_stage='encoding',
                  progress=5,
                  worker_id=worker_id)

    cmd = ['ffmpeg', '-y', '-i', input_file]

    # Video
    if reencode_video:
        cmd += ['-c:v', encoder] + encoder_opts + [
            '-profile:v', 'main', '-level:v', '4.1', '-pix_fmt', 'yuv420p'
        ]
    else:
        cmd += ['-c:v', 'copy']

    # Audio
    if reencode_audio:
        cmd += ['-c:a', 'aac', '-b:a', '192k', '-ac', '2']
    else:
        cmd += ['-c:a', 'copy']

    # Subtitles → mov_text for MP4
    sub_format = info.get('subtitle_format')
    if sub_format:
        if sub_format in ('subrip', 'srt', 'ass', 'ssa'):
            cmd += ['-map', '0:s?', '-c:s', 'mov_text']
        else:
            cmd += ['-sn']  # Drop incompatible subtitle formats
    else:
        cmd += ['-sn']

    cmd += [
        '-movflags', '+faststart',
        '-map', '0:v:0',
        '-map', '0:a:0?',
        output_file
    ]

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            universal_newlines=True
        )

        last_progress_update = time.time()
        for line in process.stderr:
            if 'time=' in line and duration > 0:
                try:
                    time_str = line.split('time=')[1].split()[0]
                    parts = time_str.split(':')
                    if len(parts) == 3:
                        current = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
                        pct = min(int((current / duration) * 95), 95)
                        remaining = int((duration - current) * (1 if mode == 'remux' else 2))
                        # Throttle updates to every 5 seconds
                        if time.time() - last_progress_update >= 5:
                            update_status(conversion_id, 'processing',
                                          progress=pct,
                                          estimated_seconds_remaining=max(remaining, 0),
                                          conversion_stage='encoding')
                            last_progress_update = time.time()
                except Exception:
                    pass

        process.wait()
        return process.returncode == 0
    except Exception as e:
        log(f"FFmpeg error: {e}", 'ERROR')
        return False


def generate_hls(input_file: str, output_dir: str, use_gpu: bool,
                 conversion_id: str) -> bool:
    """Generate adaptive bitrate HLS output with separate audio groups per language."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    encoder, encoder_opts = get_encoder_config(use_gpu)

    update_status(conversion_id, 'processing',
                  conversion_stage='hls_generation', progress=80)

    # ── Detect audio tracks ──
    probe_data = probe_video(input_file)
    audio_streams = [
        s for s in probe_data.get('streams', [])
        if s.get('codec_type') == 'audio'
    ]

    # Build language metadata for each audio stream
    LANG_LABELS = {
        'hin': 'Hindi', 'hi': 'Hindi', 'hindi': 'Hindi',
        'eng': 'English', 'en': 'English', 'english': 'English',
        'jpn': 'Japanese', 'ja': 'Japanese', 'japanese': 'Japanese',
    }

    audio_tracks: List[Dict[str, Any]] = []
    for idx, stream in enumerate(audio_streams):
        tags = stream.get('tags', {})
        lang_code = (tags.get('language') or 'und').lower()
        title = tags.get('title', '')
        label = LANG_LABELS.get(lang_code) or LANG_LABELS.get(title.lower(), title or f'Audio {idx + 1}')
        audio_tracks.append({
            'index': stream['index'],
            'idx': idx,
            'lang': lang_code if lang_code != 'und' else f'und{idx}',
            'label': label,
            'default': idx == 0,
        })

    if not audio_tracks:
        audio_tracks = [{'index': 1, 'idx': 0, 'lang': 'und', 'label': 'Default', 'default': True}]

    log(f"HLS: Detected {len(audio_tracks)} audio tracks: {[t['label'] for t in audio_tracks]}")

    # ── Build ffmpeg command ──
    cmd = ['ffmpeg', '-y', '-i', input_file]

    # Detect source resolution to determine which quality tiers to include
    probe_cmd = ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                 '-show_entries', 'stream=height', '-of', 'csv=p=0', input_file]
    try:
        source_height = int(subprocess.check_output(probe_cmd, text=True).strip())
    except Exception:
        source_height = 1080  # default assumption

    log(f"HLS: Source resolution height = {source_height}p")

    # Build quality tiers based on source resolution (low to high)
    quality_tiers = []
    all_tiers = [
        {'height': 144,  'width': 256,  'bitrate': '200k',  'maxrate': '214k',  'bufsize': '300k',  'label': '144p'},
        {'height': 240,  'width': 426,  'bitrate': '400k',  'maxrate': '428k',  'bufsize': '600k',  'label': '240p'},
        {'height': 360,  'width': 640,  'bitrate': '800k',  'maxrate': '856k',  'bufsize': '1200k', 'label': '360p'},
        {'height': 480,  'width': 854,  'bitrate': '1400k', 'maxrate': '1498k', 'bufsize': '2100k', 'label': '480p'},
        {'height': 720,  'width': 1280, 'bitrate': '2800k', 'maxrate': '2996k', 'bufsize': '4200k', 'label': '720p'},
        {'height': 1080, 'width': 1920, 'bitrate': '5000k', 'maxrate': '5350k', 'bufsize': '7500k', 'label': '1080p'},
        {'height': 1440, 'width': 2560, 'bitrate': '8000k', 'maxrate': '8560k', 'bufsize': '12000k','label': '1440p'},
        {'height': 2160, 'width': 3840, 'bitrate': '14000k','maxrate': '14980k','bufsize': '21000k','label': '2160p'},
    ]
    for tier in all_tiers:
        if tier['height'] <= source_height:
            quality_tiers.append(tier)
    # Ensure at least 360p, 720p, 1080p if source is >= 1080p
    if not quality_tiers:
        quality_tiers = [all_tiers[2]]  # at least 360p

    num_qualities = len(quality_tiers)
    log(f"HLS: Generating {num_qualities} quality tiers: {[t['label'] for t in quality_tiers]}")

    # Video filter complex for ABR
    split_labels = ''.join([f'[v{i}]' for i in range(num_qualities)])
    scale_filters = ';'.join([
        f'[v{i}]scale=w={t["width"]}:h={t["height"]}:force_original_aspect_ratio=decrease[v{t["height"]}]'
        for i, t in enumerate(quality_tiers)
    ])
    filter_complex = f'[0:v]split={num_qualities}{split_labels};{scale_filters}'

    cmd += ['-filter_complex', filter_complex]

    # Map video streams
    for i, tier in enumerate(quality_tiers):
        cmd += ['-map', f'[v{tier["height"]}]', f'-c:v:{i}', encoder, *encoder_opts,
                f'-b:v:{i}', tier['bitrate'], f'-maxrate:v:{i}', tier['maxrate'],
                f'-bufsize:v:{i}', tier['bufsize']]

    # Map each audio track separately for each video quality level
    audio_stream_idx = 0
    for track in audio_tracks:
        for _vq in range(3):  # one audio per video quality
            cmd += ['-map', f'0:a:{track["idx"]}', f'-c:a:{audio_stream_idx}', 'aac',
                    f'-b:a:{audio_stream_idx}', '128k', f'-ac:{audio_stream_idx}', '2']
            audio_stream_idx += 1

    cmd += [
        '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-level:v', '4.1',
        '-sn',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', f'{output_dir}/segment_%v_%03d.ts',
        '-master_pl_name', 'master.m3u8',
    ]

    # Build var_stream_map: "v:0,a:0,agroup:hindi,... v:0,a:1,agroup:english,..."
    # For multi-audio: each video quality maps to a separate audio group entry
    var_entries = []
    audio_idx = 0
    for vq in range(3):  # 3 video qualities
        for tidx, track in enumerate(audio_tracks):
            name_safe = track['label'].replace(' ', '_').lower()
            default_str = 'YES' if track['default'] else 'NO'
            lang = track['lang'][:3] if len(track['lang']) >= 3 else track['lang']
            var_entries.append(
                f'v:{vq},a:{audio_idx},agroup:audio,name:{name_safe}_{vq}p,language:{lang},default:{default_str}'
            )
            audio_idx += 1

    cmd += ['-var_stream_map', ' '.join(var_entries)]
    cmd += [f'{output_dir}/stream_%v.m3u8']

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
        if result.returncode != 0:
            log(f"HLS stderr: {result.stderr[-500:]}", 'ERROR')

            # Fallback: simpler single-audio HLS if multi-audio fails
            log("Falling back to single-audio HLS generation")
            return generate_hls_simple(input_file, output_dir, encoder, encoder_opts, conversion_id)
        return True
    except Exception as e:
        log(f"HLS error: {e}", 'ERROR')
        return False


def generate_hls_simple(input_file: str, output_dir: str, encoder: str,
                        encoder_opts: List[str], conversion_id: str) -> bool:
    """Fallback: simple single-audio HLS generation."""
    cmd = [
        'ffmpeg', '-y', '-i', input_file,
        '-filter_complex',
        '[0:v]split=3[v1][v2][v3];'
        '[v1]scale=w=640:h=360:force_original_aspect_ratio=decrease[v360];'
        '[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v720];'
        '[v3]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[v1080]',
        '-map', '[v360]', '-c:v:0', encoder, *encoder_opts,
        '-b:v:0', '800k', '-maxrate:v:0', '856k', '-bufsize:v:0', '1200k',
        '-map', '[v720]', '-c:v:1', encoder, *encoder_opts,
        '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k',
        '-map', '[v1080]', '-c:v:2', encoder, *encoder_opts,
        '-b:v:2', '5000k', '-maxrate:v:2', '5350k', '-bufsize:v:2', '7500k',
        '-map', '0:a', '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-level:v', '4.1',
        '-sn',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', f'{output_dir}/segment_%v_%03d.ts',
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', 'v:0,a:0 v:1,a:0 v:2,a:0',
        f'{output_dir}/stream_%v.m3u8'
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
        return result.returncode == 0
    except Exception as e:
        log(f"HLS simple fallback error: {e}", 'ERROR')
        return False


# ── Error recovery ─────────────────────────────────────────────────────────────
def attempt_auto_fix(input_file: str, info: Dict) -> Optional[str]:
    """Try to fix common issues before conversion."""
    temp_dir = Path(STORAGE_BASE_PATH) / 'temp'
    temp_dir.mkdir(parents=True, exist_ok=True)
    fixed_file = str(temp_dir / f"fixed_{Path(input_file).name}")

    # If container is corrupt, try remuxing first
    container = (info.get('container_format') or '').lower()
    if 'matroska' in container or 'avi' in container or 'webm' in container:
        log("Auto-fix: remuxing from non-MP4 container")
        try:
            result = subprocess.run([
                'ffmpeg', '-y', '-i', input_file,
                '-c', 'copy', '-movflags', '+faststart', fixed_file
            ], capture_output=True, text=True, timeout=600)
            if result.returncode == 0 and Path(fixed_file).exists():
                return fixed_file
        except Exception:
            pass

    return None


# ── Main conversion pipeline ──────────────────────────────────────────────────
def process_conversion(conversion: Dict[str, Any], use_gpu: bool) -> bool:
    conversion_id = conversion['id']
    original_url = conversion.get('original_url', '')
    original_path = conversion.get('original_path', original_url)
    retry_count = conversion.get('retry_count', 0)

    log(f"Processing: {conversion_id} (retry={retry_count})")

    update_status(conversion_id, 'processing',
                  conversion_stage='analyzing',
                  progress=0,
                  worker_id=worker_id)

    try:
        # ── Step 1: Resolve input file ──
        filename = Path(original_path).name
        input_file = str(Path(STORAGE_BASE_PATH) / 'original' / filename)

        if not Path(input_file).exists():
            log("Downloading from URL...")
            Path(input_file).parent.mkdir(parents=True, exist_ok=True)
            try:
                resp = requests.get(original_url, stream=True, timeout=300)
                resp.raise_for_status()
                with open(input_file, 'wb') as f:
                    for chunk in resp.iter_content(8192):
                        f.write(chunk)
            except Exception as e:
                update_status(conversion_id, 'failed',
                              error_message=f"Download failed: {e}",
                              conversion_stage='failed')
                return False

        # ── Step 2: Analyze with ffprobe ──
        update_status(conversion_id, 'processing',
                      conversion_stage='analyzing', progress=2)
        probe_data = probe_video(input_file)
        info = analyze_compatibility(probe_data)

        log(f"Analysis: codec={info['video_codec']}, profile={info['video_profile']}, "
            f"pix={info['pixel_format']}, audio={info['audio_codec']}, "
            f"compatible={info['ios_compatible']}, issues={info['issues']}")

        # ── Step 3: Check if already compatible (smart skip) ──
        if info['ios_compatible']:
            log("Already iOS-compatible! Remuxing with faststart only.")
            stem = Path(original_path).stem
            ios_dir = Path(STORAGE_BASE_PATH) / 'ios_ready'
            ios_dir.mkdir(parents=True, exist_ok=True)
            output_file = str(ios_dir / f"{stem}.mp4")

            # Just remux to ensure faststart
            result = subprocess.run([
                'ffmpeg', '-y', '-i', input_file,
                '-c', 'copy', '-movflags', '+faststart', output_file
            ], capture_output=True, text=True, timeout=600)

            if result.returncode == 0:
                file_size = Path(output_file).stat().st_size
                ios_url = f"{CDN_BASE_URL}/ios_ready/{stem}.mp4"
                update_status(conversion_id, 'completed',
                              ios_ready_url=ios_url,
                              ios_ready_path=output_file,
                              ios_file_size_bytes=file_size,
                              video_codec=info['video_codec'],
                              audio_codec=info['audio_codec'],
                              is_10bit=info['is_10bit'],
                              is_hevc=info['is_hevc'],
                              progress=100,
                              conversion_stage='completed',
                              ios_compatible=True,
                              video_profile=info['video_profile'],
                              pixel_format=info['pixel_format'],
                              audio_channels=info['audio_channels'],
                              audio_sample_rate=info['audio_sample_rate'],
                              container_format='mp4')
                return True

        # ── Step 4: Convert (smart mode) ──
        stem = Path(original_path).stem
        ios_dir = Path(STORAGE_BASE_PATH) / 'ios_ready'
        ios_dir.mkdir(parents=True, exist_ok=True)
        output_file = str(ios_dir / f"{stem}.mp4")

        success = smart_convert(input_file, output_file, info, use_gpu, conversion_id)

        if not success:
            # ── Step 4b: Auto-fix and retry ──
            log("Conversion failed, attempting auto-fix...")
            fixed = attempt_auto_fix(input_file, info)
            if fixed:
                success = smart_convert(fixed, output_file, info, use_gpu, conversion_id)
                # Cleanup temp
                try:
                    Path(fixed).unlink()
                except Exception:
                    pass

        if not success:
            # ── Step 4c: Retry or fail ──
            if retry_count < 2:
                log(f"Scheduling retry {retry_count + 1}")
                update_status(conversion_id, 'pending',
                              error_message=f"Retry {retry_count + 1}/2 scheduled",
                              retry_count=retry_count + 1,
                              conversion_stage='retry_pending')
            else:
                update_status(conversion_id, 'failed',
                              error_message="Max retries exceeded",
                              conversion_stage='failed')
            return False

        # ── Step 5: Verify output ──
        if not Path(output_file).exists() or Path(output_file).stat().st_size < 1000:
            update_status(conversion_id, 'failed',
                          error_message="Output file missing or too small",
                          conversion_stage='failed')
            return False

        # Verify output compatibility
        output_probe = probe_video(output_file)
        output_info = analyze_compatibility(output_probe)

        file_size = Path(output_file).stat().st_size
        ios_url = f"{CDN_BASE_URL}/ios_ready/{stem}.mp4"

        update_status(conversion_id, 'completed',
                      ios_ready_url=ios_url,
                      ios_ready_path=output_file,
                      ios_file_size_bytes=file_size,
                      video_codec=output_info['video_codec'],
                      audio_codec=output_info['audio_codec'],
                      is_10bit=output_info['is_10bit'],
                      is_hevc=output_info['is_hevc'],
                      progress=95,
                      conversion_stage='packaging',
                      ios_compatible=output_info['ios_compatible'],
                      video_profile=output_info['video_profile'],
                      pixel_format=output_info['pixel_format'],
                      audio_channels=output_info['audio_channels'],
                      audio_sample_rate=output_info['audio_sample_rate'],
                      container_format='mp4')

        # ── Step 6: Generate HLS ──
        hls_dir = str(Path(STORAGE_BASE_PATH) / 'hls' / stem)
        if generate_hls(output_file, hls_dir, use_gpu, conversion_id):
            hls_url = f"{CDN_BASE_URL}/hls/{stem}/master.m3u8"
            update_status(conversion_id, 'completed',
                          hls_url=hls_url,
                          progress=100,
                          conversion_stage='completed')
            log(f"HLS generated: {hls_url}")
        else:
            log("HLS generation failed (non-critical)", 'WARN')
            # Still mark as completed since MP4 is ready
            update_status(conversion_id, 'completed',
                          progress=100,
                          conversion_stage='completed')

        log(f"Conversion complete: {ios_url}")
        return True

    except Exception as e:
        log(f"Fatal error: {e}", 'ERROR')
        if retry_count < 2:
            update_status(conversion_id, 'pending',
                          error_message=f"Error: {e}",
                          retry_count=retry_count + 1,
                          conversion_stage='retry_pending')
        else:
            update_status(conversion_id, 'failed',
                          error_message=str(e),
                          conversion_stage='failed')
        return False


# ── Main worker loop ──────────────────────────────────────────────────────────
def worker_loop(use_gpu: bool, max_concurrent: int, poll_interval: int):
    log(f"Worker started (GPU={use_gpu}, Workers={max_concurrent}, Poll={poll_interval}s)")

    if use_gpu:
        gpu = check_gpu_encoder()
        log(f"GPU encoder: {gpu}")

    cleanup_counter = 0

    with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
        while not shutdown_event.is_set():
            # Resource protection
            if system_overloaded():
                log("System overloaded, pausing for 30s", 'WARN')
                shutdown_event.wait(30)
                continue

            try:
                pending = get_pending_conversions()

                if pending:
                    # Limit to available capacity
                    batch = pending[:max_concurrent]
                    log(f"Processing {len(batch)}/{len(pending)} pending")

                    futures = {
                        executor.submit(process_conversion, conv, use_gpu): conv['id']
                        for conv in batch
                    }

                    for future in as_completed(futures):
                        cid = futures[future]
                        try:
                            result = future.result()
                            log(f"Job {cid}: {'OK' if result else 'FAILED'}")
                        except Exception as e:
                            log(f"Job {cid} exception: {e}", 'ERROR')
                else:
                    log(f"No pending jobs, sleeping {poll_interval}s")

            except Exception as e:
                log(f"Loop error: {e}", 'ERROR')

            # Periodic temp cleanup
            cleanup_counter += 1
            if cleanup_counter >= 20:
                cleanup_temp_files()
                cleanup_counter = 0

            shutdown_event.wait(poll_interval)

    log("Worker shutdown complete")


def signal_handler(signum, frame):
    log("Shutdown signal received")
    shutdown_event.set()


def main():
    parser = argparse.ArgumentParser(description='Production FFmpeg Worker')
    parser.add_argument('--gpu', action='store_true', help='Enable GPU encoding')
    parser.add_argument('--max-concurrent', type=int, default=4, help='Max parallel jobs')
    parser.add_argument('--poll-interval', type=int, default=15, help='Poll interval seconds')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        sys.exit(1)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    worker_loop(args.gpu, args.max_concurrent, args.poll_interval)


if __name__ == '__main__':
    main()
