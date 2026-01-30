#!/usr/bin/env python3
"""
FFmpeg Background Worker for iOS HLS Video Conversion
======================================================
This script runs as a background worker to process video conversions.
Deploy this on a server with FFmpeg installed (with NVENC support for GPU).

Usage:
    python ffmpeg-worker.py [--gpu] [--max-concurrent=2] [--poll-interval=30]

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
import argparse
import subprocess
import threading
import queue
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration from environment
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
STORAGE_BASE_PATH = os.getenv('STORAGE_BASE_PATH', '/mnt/videos')
CDN_BASE_URL = os.getenv('CDN_BASE_URL', 'https://your-cdn.com')

EDGE_FUNCTION_URL = f"{SUPABASE_URL}/functions/v1/video-conversion"

# Worker state
shutdown_event = threading.Event()
worker_id = f"{os.uname().nodename}-{os.getpid()}"


def log(message: str):
    """Log with timestamp and worker ID."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{worker_id}] {message}", flush=True)


def api_headers():
    """Get API request headers."""
    return {
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }


def update_status(conversion_id: str, status: str, **kwargs):
    """Update conversion status via API."""
    payload = {'conversionId': conversion_id, 'status': status}
    
    if 'ios_ready_url' in kwargs:
        payload['iosReadyUrl'] = kwargs['ios_ready_url']
    if 'ios_ready_path' in kwargs:
        payload['iosReadyPath'] = kwargs['ios_ready_path']
    if 'error_message' in kwargs:
        payload['errorMessage'] = kwargs['error_message']
    if 'ios_file_size_bytes' in kwargs:
        payload['iosFileSizeBytes'] = kwargs['ios_file_size_bytes']
    if 'video_codec' in kwargs:
        payload['videoCodec'] = kwargs['video_codec']
    if 'audio_codec' in kwargs:
        payload['audioCodec'] = kwargs['audio_codec']
    if 'is_10bit' in kwargs:
        payload['is10bit'] = kwargs['is_10bit']
    if 'is_hevc' in kwargs:
        payload['isHevc'] = kwargs['is_hevc']
    if 'progress' in kwargs:
        payload['progress'] = kwargs['progress']
    
    try:
        response = requests.post(
            f"{EDGE_FUNCTION_URL}?action=update-status",
            headers=api_headers(),
            json=payload
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        log(f"Error updating status: {e}")
        return None


def get_pending_conversions() -> list:
    """Fetch pending conversions from API."""
    try:
        response = requests.get(
            f"{EDGE_FUNCTION_URL}?action=pending",
            headers=api_headers()
        )
        response.raise_for_status()
        data = response.json()
        return data.get('conversions', [])
    except Exception as e:
        log(f"Error fetching pending: {e}")
        return []


def detect_video_properties(input_file: str) -> Dict[str, Any]:
    """Detect video properties using ffprobe."""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', input_file
        ], capture_output=True, text=True)
        return json.loads(result.stdout)
    except Exception as e:
        log(f"Error detecting video properties: {e}")
        return {}


def check_gpu_encoder() -> str:
    """Check available GPU encoder."""
    try:
        result = subprocess.run(
            ['ffmpeg', '-encoders'],
            capture_output=True, text=True
        )
        output = result.stdout
        
        if 'h264_nvenc' in output:
            return 'nvenc'
        elif 'h264_videotoolbox' in output:
            return 'videotoolbox'
        elif 'h264_vaapi' in output:
            return 'vaapi'
    except Exception:
        pass
    return 'cpu'


def get_encoder_options(use_gpu: bool) -> tuple:
    """Get FFmpeg encoder and options based on availability."""
    if not use_gpu:
        return 'libx264', ['-preset', 'medium', '-crf', '23']
    
    gpu_type = check_gpu_encoder()
    
    if gpu_type == 'nvenc':
        log("Using NVIDIA NVENC GPU encoding")
        return 'h264_nvenc', ['-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '23']
    elif gpu_type == 'videotoolbox':
        log("Using Apple VideoToolbox GPU encoding")
        return 'h264_videotoolbox', ['-q:v', '65']
    elif gpu_type == 'vaapi':
        log("Using Intel VAAPI GPU encoding")
        return 'h264_vaapi', ['-vaapi_device', '/dev/dri/renderD128']
    else:
        log("No GPU encoder found, using CPU")
        return 'libx264', ['-preset', 'medium', '-crf', '23']


def generate_ios_mp4(input_file: str, output_file: str, use_gpu: bool, 
                     progress_callback=None) -> bool:
    """Generate iOS-compatible MP4."""
    encoder, encoder_opts = get_encoder_options(use_gpu)
    
    cmd = [
        'ffmpeg', '-y', '-i', input_file,
        '-c:v', encoder,
        *encoder_opts,
        '-profile:v', 'high',
        '-level:v', '4.1',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ac', '2',
        '-movflags', '+faststart',
        '-sn',
        '-map', '0:v:0',
        '-map', '0:a:0?',
        output_file
    ]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Monitor progress
        for line in process.stderr:
            if 'time=' in line and progress_callback:
                # Parse time from FFmpeg output
                try:
                    time_str = line.split('time=')[1].split()[0]
                    parts = time_str.split(':')
                    if len(parts) == 3:
                        h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
                        current_seconds = h * 3600 + m * 60 + s
                        progress_callback(current_seconds)
                except Exception:
                    pass
        
        process.wait()
        return process.returncode == 0
    except Exception as e:
        log(f"FFmpeg error: {e}")
        return False


def generate_hls(input_file: str, output_dir: str, use_gpu: bool) -> bool:
    """Generate multi-quality HLS output."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    encoder, encoder_opts = get_encoder_options(use_gpu)
    
    cmd = [
        'ffmpeg', '-y', '-i', input_file,
        '-filter_complex',
        '[0:v]split=3[v1][v2][v3];'
        '[v1]scale=w=640:h=360:force_original_aspect_ratio=decrease[v360];'
        '[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease[v720];'
        '[v3]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[v1080]',
        # 360p
        '-map', '[v360]', '-c:v:0', encoder, *encoder_opts,
        '-b:v:0', '800k', '-maxrate:v:0', '856k', '-bufsize:v:0', '1200k',
        # 720p
        '-map', '[v720]', '-c:v:1', encoder, *encoder_opts,
        '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k',
        # 1080p
        '-map', '[v1080]', '-c:v:2', encoder, *encoder_opts,
        '-b:v:2', '5000k', '-maxrate:v:2', '5350k', '-bufsize:v:2', '7500k',
        # Audio
        '-map', '0:a', '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        # Common options
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high', '-level:v', '4.1',
        '-sn',
        # HLS options
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', f'{output_dir}/segment_%v_%03d.ts',
        '-master_pl_name', 'master.m3u8',
        '-var_stream_map', 'v:0,a:0 v:1,a:0 v:2,a:0',
        f'{output_dir}/stream_%v.m3u8'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0
    except Exception as e:
        log(f"HLS generation error: {e}")
        return False


def process_conversion(conversion: Dict[str, Any], use_gpu: bool) -> bool:
    """Process a single video conversion."""
    conversion_id = conversion['id']
    original_url = conversion.get('original_url', '')
    original_path = conversion.get('original_path', original_url)
    
    log(f"Starting conversion: {conversion_id}")
    log(f"Input: {original_path}")
    
    # Update status to processing
    update_status(conversion_id, 'processing')
    
    try:
        # Determine input file path
        filename = Path(original_path).name
        input_file = Path(STORAGE_BASE_PATH) / 'original' / filename
        
        if not input_file.exists():
            # Try downloading from URL
            log("Local file not found, attempting download...")
            input_file.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                response = requests.get(original_url, stream=True)
                response.raise_for_status()
                with open(input_file, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
            except Exception as e:
                update_status(conversion_id, 'failed', error_message=f"Could not access input file: {e}")
                return False
        
        # Create output paths
        stem = Path(original_path).stem
        ios_output_dir = Path(STORAGE_BASE_PATH) / 'ios_ready'
        ios_output_dir.mkdir(parents=True, exist_ok=True)
        ios_output_file = ios_output_dir / f"{stem}.mp4"
        
        # Detect video properties
        props = detect_video_properties(str(input_file))
        video_codec = None
        audio_codec = None
        is_10bit = False
        is_hevc = False
        
        for stream in props.get('streams', []):
            if stream.get('codec_type') == 'video' and not video_codec:
                video_codec = stream.get('codec_name', 'unknown')
                pix_fmt = stream.get('pix_fmt', '')
                is_10bit = '10' in pix_fmt
                is_hevc = 'hevc' in video_codec.lower() or 'h265' in video_codec.lower()
            elif stream.get('codec_type') == 'audio' and not audio_codec:
                audio_codec = stream.get('codec_name', 'unknown')
        
        log(f"Detected: video={video_codec}, audio={audio_codec}, 10bit={is_10bit}, hevc={is_hevc}")
        
        # Generate iOS-compatible MP4
        if generate_ios_mp4(str(input_file), str(ios_output_file), use_gpu):
            ios_ready_url = f"{CDN_BASE_URL}/ios_ready/{stem}.mp4"
            file_size = ios_output_file.stat().st_size
            
            log(f"Conversion successful: {ios_ready_url}")
            
            update_status(
                conversion_id, 'completed',
                ios_ready_url=ios_ready_url,
                ios_ready_path=str(ios_output_file),
                ios_file_size_bytes=file_size,
                video_codec=video_codec,
                audio_codec=audio_codec,
                is_10bit=is_10bit,
                is_hevc=is_hevc
            )
            return True
        else:
            log(f"Conversion failed for: {conversion_id}")
            update_status(conversion_id, 'failed', error_message="FFmpeg conversion failed")
            return False
            
    except Exception as e:
        log(f"Error processing {conversion_id}: {e}")
        update_status(conversion_id, 'failed', error_message=str(e))
        return False


def worker_loop(use_gpu: bool, max_concurrent: int, poll_interval: int):
    """Main worker loop."""
    log(f"Starting FFmpeg worker (GPU={use_gpu}, MaxConcurrent={max_concurrent})")
    
    if use_gpu:
        gpu_type = check_gpu_encoder()
        log(f"GPU encoder detected: {gpu_type}")
    
    with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
        while not shutdown_event.is_set():
            try:
                # Get pending conversions
                pending = get_pending_conversions()
                
                if pending:
                    log(f"Found {len(pending)} pending conversions")
                    
                    # Submit up to max_concurrent jobs
                    futures = []
                    for conversion in pending[:max_concurrent]:
                        future = executor.submit(process_conversion, conversion, use_gpu)
                        futures.append(future)
                    
                    # Wait for completion
                    for future in as_completed(futures):
                        try:
                            future.result()
                        except Exception as e:
                            log(f"Job error: {e}")
                else:
                    log(f"No pending conversions, sleeping for {poll_interval} seconds")
                
            except Exception as e:
                log(f"Worker loop error: {e}")
            
            # Sleep with interrupt support
            shutdown_event.wait(poll_interval)
    
    log("Worker shutdown complete")


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    log("Shutdown signal received")
    shutdown_event.set()


def main():
    parser = argparse.ArgumentParser(description='FFmpeg Background Worker')
    parser.add_argument('--gpu', action='store_true', help='Enable GPU encoding')
    parser.add_argument('--max-concurrent', type=int, default=2, help='Max concurrent jobs')
    parser.add_argument('--poll-interval', type=int, default=30, help='Poll interval in seconds')
    args = parser.parse_args()
    
    # Validate environment
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        sys.exit(1)
    
    # Register signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Run worker
    worker_loop(args.gpu, args.max_concurrent, args.poll_interval)


if __name__ == '__main__':
    main()
