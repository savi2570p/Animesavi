# Video Encoding Guide for AnimeSavi

## Mobile Playback Compatibility

### Supported Formats (HTML5 Native)
| Format | Extension | Mobile Support | Notes |
|--------|-----------|----------------|-------|
| MP4 (H.264) | `.mp4` | ✅ All devices | **Recommended** |
| WebM (VP9) | `.webm` | ✅ All devices | Good alternative |
| OGG | `.ogg`, `.ogv` | ⚠️ Partial | Desktop only |
| HLS | `.m3u8` | ✅ All devices | **Best for streaming** |

### Unsupported Formats (Require Conversion)
| Format | Extension | Issue |
|--------|-----------|-------|
| MKV | `.mkv` | Container not supported |
| AVI | `.avi` | Legacy format |
| MOV | `.mov` | Limited mobile support |
| WMV | `.wmv` | Windows-only codec |
| FLV | `.flv` | Flash-based, deprecated |
| MP4V | `.mp4v` | Rare variant |

## Critical Root Cause Analysis

Universal video playback failures across all devices typically stem from:

**Main Profile (Better Quality for 1080p):**
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ac 2 \
  -movflags +faststart \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" \
  output_1080p_main.mp4
```

### For HLS Streaming (Adaptive Bitrate)

**720p Variant:**
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset fast -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 \
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \
  -f hls -hls_time 10 -hls_playlist_type vod \
  -hls_segment_filename 'segment_720p_%03d.ts' \
  stream_720p.m3u8
```

**1080p Variant:**
```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ac 2 \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" \
  -f hls -hls_time 10 -hls_playlist_type vod \
  -hls_segment_filename 'segment_1080p_%03d.ts' \
  stream_1080p.m3u8
```

**Master Playlist:**
```bash
cat > master.m3u8 << EOF
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
stream_720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
stream_1080p.m3u8
EOF
```

## Server Configuration

### Required HTTP Headers

```nginx
# For MP4 files
location ~* \.(mp4)$ {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Origin, Range, Accept, If-Range';
    add_header 'Accept-Ranges' 'bytes';
    add_header 'Cache-Control' 'public, max-age=31536000';
    add_header 'Content-Type' 'video/mp4';
}

# For HLS manifests
location ~* \.(m3u8)$ {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Origin, Range, Accept, If-Range';
    add_header 'Content-Type' 'application/x-mpegURL';
    add_header 'Cache-Control' 'public, max-age=600';
}

# For HLS segments
location ~* \.ts$ {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Origin, Range, Accept, If-Range';
    add_header 'Accept-Ranges' 'bytes';
    add_header 'Content-Type' 'video/MP2T';
    add_header 'Cache-Control' 'public, max-age=31536000';
}
```

### Supabase Storage Configuration

Ensure your storage bucket has:
- Public access enabled
- CORS configured properly
- Byte-range support (enabled by default)

## Frontend Implementation

The video players in this project are already configured with:
- HLS.js for adaptive streaming
- Mobile-optimized buffering
- Network error retry logic
- Proper CORS handling
- iOS/Android specific attributes

## Verification Checklist

### Encoding
- [ ] H.264 codec (Baseline or Main profile)
- [ ] Level 3.1-4.0 for compatibility
- [ ] AAC-LC audio codec
- [ ] MP4 files have `faststart` flag
- [ ] YUV420p pixel format
- [ ] Proper resolution scaling

### Server
- [ ] Correct Content-Type headers
- [ ] Accept-Ranges: bytes header present
- [ ] CORS headers configured
- [ ] Byte-range requests work
- [ ] HTTP/2 or HTTP/3 enabled

### Testing
- [ ] iOS Safari (Wi-Fi + Cellular)
- [ ] Android Chrome (Wi-Fi + Cellular)
- [ ] Desktop Chrome/Firefox/Edge
- [ ] Seeking works smoothly
- [ ] No black screens
- [ ] Playback starts within 3 seconds
- [ ] Network quality switches automatically (HLS)

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Black screen on all devices | High Profile H.264 or missing faststart | Re-encode with Baseline/Main profile + faststart |
| Works on desktop, fails on mobile | Missing mobile attributes or CORS | Add playsInline, webkit-playsinline, fix CORS |
| Buffering constantly | Poor HLS configuration or encoding | Reduce segment duration, optimize bitrate ladder |
| Seeking doesn't work | No byte-range support | Enable Accept-Ranges on server |
| iOS won't autoplay | Autoplay restrictions | Mute video or require user interaction |

## Upload Process

When uploading videos to AnimeSavi:

1. **Encode properly** using commands above
2. **Verify encoding** with `ffprobe`:
   ```bash
   ffprobe -v error -select_streams v:0 \
     -show_entries stream=codec_name,profile,level,pix_fmt \
     -of default=noprint_wrappers=1 video.mp4
   ```
3. **Upload to Supabase Storage** via the Upload interface
4. **Test immediately** on multiple devices

## Performance Optimization

For large anime episodes (200-500MB):

1. **Always use HLS** for files > 100MB
2. **Create multiple bitrate variants** (360p, 720p, 1080p)
3. **Set appropriate segment duration** (8-10 seconds)
4. **Enable CDN caching** for segments
5. **Use video preload="metadata"** instead of "auto" for bandwidth savings

## References

- [HTML5 Video Compatibility](https://caniuse.com/video)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [FFmpeg Encoding Guide](https://trac.ffmpeg.org/wiki/Encode/H.264)
- [iOS Video Guidelines](https://developer.apple.com/documentation/avfoundation/media_playback)