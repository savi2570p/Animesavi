#!/bin/bash
# =============================================================================
# FFmpeg Background Worker for iOS HLS Video Conversion
# =============================================================================
# This script runs as a background worker to process video conversions.
# Deploy this on a server with FFmpeg installed (with NVENC support for GPU).
#
# Usage:
#   ./ffmpeg-worker.sh [--gpu] [--max-concurrent=2] [--poll-interval=30]
#
# Environment Variables Required:
#   SUPABASE_URL        - Your Supabase project URL
#   SUPABASE_SERVICE_KEY - Your Supabase service role key
#   STORAGE_BASE_PATH   - Base path for video storage (e.g., /mnt/videos)
#   CDN_BASE_URL        - Base URL for CDN delivery (e.g., https://cdn.example.com)
#
# =============================================================================

set -e

# Configuration
USE_GPU=false
MAX_CONCURRENT=2
POLL_INTERVAL=30
WORKER_ID=$(hostname)-$$

# Parse arguments
for arg in "$@"; do
  case $arg in
    --gpu)
      USE_GPU=true
      shift
      ;;
    --max-concurrent=*)
      MAX_CONCURRENT="${arg#*=}"
      shift
      ;;
    --poll-interval=*)
      POLL_INTERVAL="${arg#*=}"
      shift
      ;;
  esac
done

# Validate environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
  exit 1
fi

if [ -z "$STORAGE_BASE_PATH" ]; then
  STORAGE_BASE_PATH="/mnt/videos"
fi

if [ -z "$CDN_BASE_URL" ]; then
  CDN_BASE_URL="https://your-cdn.com"
fi

# API endpoint
EDGE_FUNCTION_URL="$SUPABASE_URL/functions/v1/video-conversion"

# Logging function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$WORKER_ID] $1"
}

# Update conversion status via API
update_status() {
  local conversion_id=$1
  local status=$2
  local ios_ready_url=$3
  local error_message=$4
  local progress=$5
  
  local body="{\"conversionId\":\"$conversion_id\",\"status\":\"$status\""
  
  if [ -n "$ios_ready_url" ]; then
    body="$body,\"iosReadyUrl\":\"$ios_ready_url\""
  fi
  
  if [ -n "$error_message" ]; then
    body="$body,\"errorMessage\":\"$error_message\""
  fi
  
  if [ -n "$progress" ]; then
    body="$body,\"progress\":$progress"
  fi
  
  body="$body}"
  
  curl -s -X POST "$EDGE_FUNCTION_URL?action=update-status" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# Get pending conversions
get_pending() {
  curl -s "$EDGE_FUNCTION_URL?action=pending" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" | jq -r '.conversions[]'
}

# Detect video properties using ffprobe
detect_video_properties() {
  local input_file=$1
  ffprobe -v quiet -print_format json -show_streams "$input_file" 2>/dev/null
}

# Check if GPU encoding is available
check_gpu() {
  if ffmpeg -encoders 2>/dev/null | grep -q "h264_nvenc"; then
    echo "nvenc"
  elif ffmpeg -encoders 2>/dev/null | grep -q "h264_videotoolbox"; then
    echo "videotoolbox"
  elif ffmpeg -encoders 2>/dev/null | grep -q "h264_vaapi"; then
    echo "vaapi"
  else
    echo "cpu"
  fi
}

# Generate HLS with multiple quality levels
generate_hls() {
  local input_file=$1
  local output_dir=$2
  local conversion_id=$3
  
  mkdir -p "$output_dir"
  
  local encoder="libx264"
  local extra_opts=""
  
  if [ "$USE_GPU" = true ]; then
    local gpu_type=$(check_gpu)
    case $gpu_type in
      nvenc)
        encoder="h264_nvenc"
        extra_opts="-preset p4 -tune hq -rc vbr -cq 23"
        log "Using NVIDIA NVENC GPU encoding"
        ;;
      videotoolbox)
        encoder="h264_videotoolbox"
        extra_opts="-q:v 65"
        log "Using Apple VideoToolbox GPU encoding"
        ;;
      vaapi)
        encoder="h264_vaapi"
        extra_opts="-vaapi_device /dev/dri/renderD128"
        log "Using Intel VAAPI GPU encoding"
        ;;
      *)
        log "No GPU encoder found, using CPU"
        extra_opts="-preset medium -crf 23"
        ;;
    esac
  else
    extra_opts="-preset medium -crf 23"
  fi
  
  # Multi-quality HLS generation
  # 360p, 720p, 1080p variants with adaptive bitrate
  
  ffmpeg -y -i "$input_file" \
    -filter_complex "[0:v]split=3[v1][v2][v3]; \
      [v1]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360]; \
      [v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720]; \
      [v3]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080]" \
    -map "[v360]" -c:v:0 "$encoder" $extra_opts -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k \
    -map "[v720]" -c:v:1 "$encoder" $extra_opts -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \
    -map "[v1080]" -c:v:2 "$encoder" $extra_opts -b:v:2 5000k -maxrate:v:2 5350k -bufsize:v:2 7500k \
    -map 0:a -c:a aac -b:a 128k -ac 2 \
    -pix_fmt yuv420p \
    -profile:v high -level:v 4.1 \
    -sn \
    -f hls \
    -hls_time 6 \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_type mpegts \
    -hls_segment_filename "$output_dir/segment_%v_%03d.ts" \
    -master_pl_name "master.m3u8" \
    -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \
    "$output_dir/stream_%v.m3u8" 2>&1 | while read line; do
      # Parse progress from FFmpeg output
      if [[ $line =~ time=([0-9]+):([0-9]+):([0-9]+) ]]; then
        hours=${BASH_REMATCH[1]}
        minutes=${BASH_REMATCH[2]}
        seconds=${BASH_REMATCH[3]}
        # Update progress (simplified - you'd calculate percentage based on duration)
        log "Encoding progress: ${hours}:${minutes}:${seconds}"
      fi
    done
    
  return $?
}

# Generate single MP4 for iOS with ALL audio tracks and subtitles preserved
generate_ios_mp4() {
  local input_file=$1
  local output_file=$2
  local conversion_id=$3
  
  local encoder="libx264"
  local extra_opts="-preset medium -crf 23"
  
  if [ "$USE_GPU" = true ]; then
    local gpu_type=$(check_gpu)
    case $gpu_type in
      nvenc)
        encoder="h264_nvenc"
        extra_opts="-preset p4 -tune hq -rc vbr -cq 23"
        ;;
      videotoolbox)
        encoder="h264_videotoolbox"
        extra_opts="-q:v 65"
        ;;
    esac
  fi
  
  # Detect if file has malformed container (.mkv.mp4 etc.)
  local basename_file=$(basename "$input_file")
  local is_malformed=false
  if echo "$basename_file" | grep -qiE '\.(mkv|avi|webm)\.(mp4|m4v)$'; then
    is_malformed=true
    log "Malformed container detected: $basename_file - will fully remux & reconvert"
  fi
  
  # Count audio tracks
  local audio_count=$(ffprobe -v quiet -select_streams a -show_entries stream=index -of csv=p=0 "$input_file" 2>/dev/null | wc -l)
  log "Detected $audio_count audio track(s)"
  
  # Build audio mapping - map ALL audio tracks
  local audio_maps=""
  if [ "$audio_count" -gt 0 ]; then
    audio_maps="-map 0:a"
  else
    audio_maps="-map 0:a:0"
  fi
  
  # Build subtitle mapping
  local sub_maps=""
  local sub_count=$(ffprobe -v quiet -select_streams s -show_entries stream=index -of csv=p=0 "$input_file" 2>/dev/null | wc -l)
  if [ "$sub_count" -gt 0 ]; then
    sub_maps="-map 0:s? -c:s mov_text"
    log "Detected $sub_count subtitle track(s)"
  fi
  
  ffmpeg -y -i "$input_file" \
    -c:v "$encoder" $extra_opts \
    -profile:v main \
    -level:v 4.1 \
    -pix_fmt yuv420p \
    $audio_maps \
    -c:a aac \
    -b:a 192k \
    -ac 2 \
    $sub_maps \
    -movflags +faststart \
    -map 0:v:0 \
    "$output_file" 2>&1
    
  return $?
}

# Process a single conversion
process_conversion() {
  local conversion_json=$1
  
  local id=$(echo "$conversion_json" | jq -r '.id')
  local original_url=$(echo "$conversion_json" | jq -r '.original_url')
  local original_path=$(echo "$conversion_json" | jq -r '.original_path')
  
  log "Starting conversion: $id"
  log "Input: $original_path"
  
  # Update status to processing
  update_status "$id" "processing"
  
  # Determine input file path
  local input_file="$STORAGE_BASE_PATH/original/$(basename "$original_path")"
  
  if [ ! -f "$input_file" ]; then
    # Try downloading from URL if local file not found
    log "Local file not found, attempting download..."
    mkdir -p "$STORAGE_BASE_PATH/original"
    if ! curl -s -o "$input_file" "$original_url"; then
      update_status "$id" "failed" "" "Could not access input file"
      return 1
    fi
  fi
  
  # Create output directory
  local filename=$(basename "$original_path" | sed 's/\.[^.]*$//')
  local hls_output_dir="$STORAGE_BASE_PATH/hls/$filename"
  local ios_output_file="$STORAGE_BASE_PATH/ios_ready/${filename}.mp4"
  
  mkdir -p "$STORAGE_BASE_PATH/hls"
  mkdir -p "$STORAGE_BASE_PATH/ios_ready"
  
  # Detect video properties
  local props=$(detect_video_properties "$input_file")
  local video_codec=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' | head -1)
  local audio_codec=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="audio") | .codec_name' | head -1)
  local is_10bit=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="video") | .pix_fmt' | grep -q "10" && echo "true" || echo "false")
  local is_hevc=$(echo "$video_codec" | grep -qi "hevc\|h265" && echo "true" || echo "false")
  
  log "Detected: video=$video_codec, audio=$audio_codec, 10bit=$is_10bit, hevc=$is_hevc"
  
  # Generate iOS-compatible MP4
  if generate_ios_mp4 "$input_file" "$ios_output_file" "$id"; then
    local ios_ready_url="$CDN_BASE_URL/ios_ready/${filename}.mp4"
    local file_size=$(stat -f%z "$ios_output_file" 2>/dev/null || stat -c%s "$ios_output_file" 2>/dev/null)
    
    log "Conversion successful: $ios_ready_url"
    
    # Update status to completed
    curl -s -X POST "$EDGE_FUNCTION_URL?action=update-status" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"conversionId\": \"$id\",
        \"status\": \"completed\",
        \"iosReadyUrl\": \"$ios_ready_url\",
        \"iosReadyPath\": \"$ios_output_file\",
        \"iosFileSizeBytes\": $file_size,
        \"videoCodec\": \"$video_codec\",
        \"audioCodec\": \"$audio_codec\",
        \"is10bit\": $is_10bit,
        \"isHevc\": $is_hevc
      }"
      
    return 0
  else
    log "Conversion failed for: $id"
    update_status "$id" "failed" "" "FFmpeg conversion failed"
    return 1
  fi
}

# Main worker loop
main() {
  log "Starting FFmpeg worker (GPU=$USE_GPU, MaxConcurrent=$MAX_CONCURRENT)"
  
  # Check GPU availability
  if [ "$USE_GPU" = true ]; then
    local gpu_type=$(check_gpu)
    log "GPU encoder detected: $gpu_type"
  fi
  
  local current_jobs=0
  
  while true; do
    # Get pending conversions
    local pending=$(curl -s "$EDGE_FUNCTION_URL?action=pending" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -H "Content-Type: application/json")
    
    local count=$(echo "$pending" | jq '.conversions | length')
    
    if [ "$count" -gt 0 ]; then
      log "Found $count pending conversions"
      
      # Process up to MAX_CONCURRENT jobs
      echo "$pending" | jq -c '.conversions[]' | head -n $MAX_CONCURRENT | while read conversion; do
        if [ -n "$conversion" ]; then
          process_conversion "$conversion" &
        fi
      done
      
      # Wait for background jobs to complete
      wait
    else
      log "No pending conversions, sleeping for $POLL_INTERVAL seconds"
    fi
    
    sleep $POLL_INTERVAL
  done
}

# Handle graceful shutdown
trap 'log "Shutting down..."; exit 0' SIGTERM SIGINT

# Run main loop
main
