#!/bin/bash
# =============================================================================
# Production-Grade FFmpeg Worker (Shell version)
# =============================================================================
# Smart processing with codec-aware conversion.
# Prefer the Python worker (ffmpeg-worker.py) for full feature set.
#
# Usage:
#   ./ffmpeg-worker.sh [--gpu] [--max-concurrent=4] [--poll-interval=15]
# =============================================================================

set -e

USE_GPU=false
MAX_CONCURRENT=4
POLL_INTERVAL=15
WORKER_ID=$(hostname)-$$

for arg in "$@"; do
  case $arg in
    --gpu) USE_GPU=true; shift ;;
    --max-concurrent=*) MAX_CONCURRENT="${arg#*=}"; shift ;;
    --poll-interval=*) POLL_INTERVAL="${arg#*=}"; shift ;;
  esac
done

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
  exit 1
fi

: "${STORAGE_BASE_PATH:=/mnt/videos}"
: "${CDN_BASE_URL:=https://your-cdn.com}"

EDGE_FUNCTION_URL="$SUPABASE_URL/functions/v1/video-conversion"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] [$WORKER_ID] $2"; }

update_status() {
  local id=$1 status=$2
  shift 2
  local body="{\"conversionId\":\"$id\",\"status\":\"$status\""
  while [ $# -gt 0 ]; do body="$body,$1"; shift; done
  body="$body}"
  curl -s -X POST "$EDGE_FUNCTION_URL?action=update-status" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null 2>&1
}

check_gpu() {
  if ffmpeg -encoders 2>/dev/null | grep -q "h264_nvenc"; then echo "nvenc"
  elif ffmpeg -encoders 2>/dev/null | grep -q "h264_videotoolbox"; then echo "videotoolbox"
  elif ffmpeg -encoders 2>/dev/null | grep -q "h264_vaapi"; then echo "vaapi"
  else echo "cpu"; fi
}

# Smart analysis: check if video needs re-encoding
analyze_video() {
  local input=$1
  ffprobe -v quiet -print_format json -show_streams -show_format "$input" 2>/dev/null
}

needs_video_reencode() {
  local props=$1
  local codec=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' | head -1)
  local profile=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="video") | .profile' | head -1)
  local pix_fmt=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="video") | .pix_fmt' | head -1)
  
  [ "$codec" != "h264" ] && return 0
  [[ ! "$profile" =~ ^(Main|Baseline|Constrained\ Baseline|High)$ ]] && return 0
  [ "$pix_fmt" != "yuv420p" ] && return 0
  return 1
}

needs_audio_reencode() {
  local props=$1
  local codec=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="audio") | .codec_name' | head -1)
  local channels=$(echo "$props" | jq -r '.streams[] | select(.codec_type=="audio") | .channels' | head -1)
  
  [ "$codec" != "aac" ] && return 0
  [ "$channels" -gt 2 ] 2>/dev/null && return 0
  return 1
}

smart_convert() {
  local input=$1 output=$2 use_gpu=$3
  local props=$(analyze_video "$input")
  
  local encoder="libx264"
  local extra_opts="-preset fast -crf 22"
  
  if [ "$use_gpu" = true ]; then
    local gpu_type=$(check_gpu)
    case $gpu_type in
      nvenc) encoder="h264_nvenc"; extra_opts="-preset p4 -tune hq -rc vbr -cq 22" ;;
      videotoolbox) encoder="h264_videotoolbox"; extra_opts="-q:v 60" ;;
      vaapi) encoder="h264_vaapi"; extra_opts="-vaapi_device /dev/dri/renderD128" ;;
    esac
  fi

  local v_opts a_opts
  if needs_video_reencode "$props"; then
    v_opts="-c:v $encoder $extra_opts -profile:v main -level:v 4.1 -pix_fmt yuv420p"
    log INFO "Re-encoding video stream"
  else
    v_opts="-c:v copy"
    log INFO "Copying video stream (already compatible)"
  fi

  if needs_audio_reencode "$props"; then
    a_opts="-c:a aac -b:a 192k -ac 2"
    log INFO "Re-encoding audio stream"
  else
    a_opts="-c:a copy"
    log INFO "Copying audio stream (already compatible)"
  fi

  ffmpeg -y -i "$input" \
    $v_opts \
    $a_opts \
    -movflags +faststart \
    -sn \
    -map 0:v:0 \
    -map 0:a:0? \
    "$output" 2>&1

  return $?
}

process_conversion() {
  local conversion_json=$1
  local id=$(echo "$conversion_json" | jq -r '.id')
  local original_url=$(echo "$conversion_json" | jq -r '.original_url')
  local original_path=$(echo "$conversion_json" | jq -r '.original_path')
  local retry_count=$(echo "$conversion_json" | jq -r '.retry_count // 0')

  log INFO "Starting: $id (retry=$retry_count)"
  update_status "$id" "processing" "\"conversionStage\":\"analyzing\"" "\"progress\":0" "\"workerId\":\"$WORKER_ID\""

  local input_file="$STORAGE_BASE_PATH/original/$(basename "$original_path")"
  
  if [ ! -f "$input_file" ]; then
    log INFO "Downloading..."
    mkdir -p "$STORAGE_BASE_PATH/original"
    if ! curl -s -o "$input_file" "$original_url"; then
      update_status "$id" "failed" "\"errorMessage\":\"Download failed\"" "\"conversionStage\":\"failed\""
      return 1
    fi
  fi

  local filename=$(basename "$original_path" | sed 's/\.[^.]*$//')
  local output_file="$STORAGE_BASE_PATH/ios_ready/${filename}.mp4"
  mkdir -p "$STORAGE_BASE_PATH/ios_ready"

  update_status "$id" "processing" "\"conversionStage\":\"encoding\"" "\"progress\":5"

  if smart_convert "$input_file" "$output_file" "$USE_GPU"; then
    local ios_url="$CDN_BASE_URL/ios_ready/${filename}.mp4"
    local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
    
    log INFO "Success: $ios_url"
    update_status "$id" "completed" \
      "\"iosReadyUrl\":\"$ios_url\"" \
      "\"iosReadyPath\":\"$output_file\"" \
      "\"iosFileSizeBytes\":$file_size" \
      "\"progress\":100" \
      "\"conversionStage\":\"completed\"" \
      "\"iosCompatible\":true"
    return 0
  else
    if [ "$retry_count" -lt 2 ]; then
      log WARN "Failed, scheduling retry $((retry_count + 1))"
      update_status "$id" "pending" \
        "\"errorMessage\":\"Retry $((retry_count + 1))/2\"" \
        "\"retryCount\":$((retry_count + 1))" \
        "\"conversionStage\":\"retry_pending\""
    else
      log ERROR "Max retries exceeded"
      update_status "$id" "failed" \
        "\"errorMessage\":\"Max retries exceeded\"" \
        "\"conversionStage\":\"failed\""
    fi
    return 1
  fi
}

# Main loop
main() {
  log INFO "Starting worker (GPU=$USE_GPU, Workers=$MAX_CONCURRENT, Poll=${POLL_INTERVAL}s)"
  
  if [ "$USE_GPU" = true ]; then
    log INFO "GPU: $(check_gpu)"
  fi
  
  while true; do
    # Resource check
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}' 2>/dev/null || echo 0)
    if [ "$cpu_usage" -gt 85 ]; then
      log WARN "CPU at ${cpu_usage}%, pausing 30s"
      sleep 30
      continue
    fi

    local pending=$(curl -s "$EDGE_FUNCTION_URL?action=pending" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -H "Content-Type: application/json")
    
    local count=$(echo "$pending" | jq '.conversions | length')
    
    if [ "$count" -gt 0 ]; then
      log INFO "Found $count pending"
      echo "$pending" | jq -c '.conversions[]' | head -n $MAX_CONCURRENT | while read conv; do
        [ -n "$conv" ] && process_conversion "$conv" &
      done
      wait
    else
      log INFO "No pending, sleeping ${POLL_INTERVAL}s"
    fi
    
    sleep $POLL_INTERVAL
  done
}

trap 'log INFO "Shutting down..."; exit 0' SIGTERM SIGINT
main
