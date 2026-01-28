# iOS Video Playback Guide - Complete MKV to HLS Solution

## Overview

This guide provides a complete solution for playing MKV videos on iOS devices (Safari, Home Screen PWA mode) by converting them to HLS format using FFmpeg.

## The Problem: MKV on iOS

| Issue | Cause |
|-------|-------|
| MKV files won't play | iOS AVPlayer doesn't support MKV container |
| Videos work on desktop but not mobile | Different codec/container support |
| PWA videos don't play | Same underlying WebKit restrictions |

## The Solution: Convert MKV to HLS

HLS (HTTP Live Streaming) is natively supported by all iOS devices and works seamlessly in Safari and PWA mode.

---

## FFmpeg Conversion Commands

### Single Quality HLS (Quick & Simple)

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v baseline -level:v 3.1 \
  -preset fast -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -movflags +faststart \
  -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_playlist_type vod \
  -hls_segment_filename 'output_%03d.ts' \
  output.m3u8
```

### MP4 Conversion (iOS Compatible - Simpler Alternative)

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v baseline -level:v 3.1 \
  -preset fast -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -movflags +faststart \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" \
  output.mp4
```

### Multi-Quality Adaptive HLS (Production Recommended)

#### 360p Variant (Mobile/Low Bandwidth)
```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v baseline -level:v 3.0 \
  -preset fast -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 64k -ac 2 -ar 44100 \
  -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
  -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \
  -hls_segment_filename 'segments/360p_%03d.ts' \
  streams/360p.m3u8
```

#### 480p Variant (SD)
```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v baseline -level:v 3.1 \
  -preset fast -crf 24 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -ac 2 -ar 44100 \
  -vf "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" \
  -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \
  -hls_segment_filename 'segments/480p_%03d.ts' \
  streams/480p.m3u8
```

#### 720p Variant (HD)
```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset fast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 -ar 44100 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \
  -hls_segment_filename 'segments/720p_%03d.ts' \
  streams/720p.m3u8
```

#### 1080p Variant (Full HD)
```bash
ffmpeg -i input.mkv \
  -c:v libx264 -profile:v main -level:v 4.0 \
  -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ac 2 -ar 48000 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \
  -hls_segment_filename 'segments/1080p_%03d.ts' \
  streams/1080p.m3u8
```

#### Master Playlist (Adaptive Bitrate)
Create `master.m3u8`:
```
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360
streams/360p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
streams/480p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
streams/720p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
streams/1080p.m3u8
```

---

## HTML Video Tag (iOS/Android/Desktop Compatible)

```html
<video
  id="video-player"
  controls
  playsinline
  webkit-playsinline="true"
  x-webkit-airplay="allow"
  x5-video-player-type="h5-page"
  x5-video-player-fullscreen="false"
  x5-playsinline="true"
  preload="metadata"
  poster="/path/to/poster.jpg"
  controlslist="nodownload noremoteplayback"
>
  <!-- HLS source (primary) -->
  <source src="/videos/master.m3u8" type="application/vnd.apple.mpegurl">
  <source src="/videos/master.m3u8" type="application/x-mpegURL">
  
  <!-- MP4 fallback for older browsers -->
  <source src="/videos/fallback.mp4" type="video/mp4">
  
  Your browser does not support HTML5 video.
</video>
```

### Critical Attributes Explained

| Attribute | Purpose |
|-----------|---------|
| `playsinline` | Prevents iOS from forcing fullscreen |
| `webkit-playsinline="true"` | Legacy iOS inline playback |
| `x-webkit-airplay="allow"` | Enables AirPlay on iOS |
| `x5-video-player-type="h5-page"` | Android WebView inline |
| `x5-playsinline="true"` | Android inline playback |
| `preload="metadata"` | Load duration/dimensions only |
| `controlslist="nodownload"` | Hide download button |

---

## JavaScript Implementation with HLS.js

```javascript
import Hls from 'hls.js';

const video = document.getElementById('video-player');
const videoUrl = '/videos/master.m3u8';

function initPlayer() {
  // iOS Safari has native HLS support
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    console.log('Using native HLS (iOS Safari)');
    video.src = videoUrl;
    
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(handleAutoplayBlocked);
    });
  } 
  // Other browsers use HLS.js
  else if (Hls.isSupported()) {
    console.log('Using HLS.js');
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startLevel: -1, // Auto quality
      capLevelToPlayerSize: true,
    });
    
    hls.loadSource(videoUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(handleAutoplayBlocked);
    });
    
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error('Network error, retrying...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error('Media error, recovering...');
            hls.recoverMediaError();
            break;
          default:
            console.error('Fatal error:', data);
            hls.destroy();
            break;
        }
      }
    });
  }
}

// Handle autoplay restrictions (iOS requires muted or user gesture)
function handleAutoplayBlocked(error) {
  console.warn('Autoplay blocked:', error);
  
  // iOS autoplay policy requires muted video
  video.muted = true;
  video.play().then(() => {
    // Show unmute button to user
    showUnmuteIndicator();
  }).catch(console.error);
}

function showUnmuteIndicator() {
  // Display "Tap to unmute" overlay
  const indicator = document.createElement('div');
  indicator.innerHTML = '🔇 Tap to unmute';
  indicator.onclick = () => {
    video.muted = false;
    indicator.remove();
  };
  video.parentElement.appendChild(indicator);
}

initPlayer();
```

---

## Server Configuration

### Nginx MIME Types & Headers

```nginx
# HLS playlist files
location ~* \.m3u8$ {
    types {
        application/vnd.apple.mpegurl m3u8;
    }
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, Range, Accept, If-Range' always;
    add_header 'Cache-Control' 'no-cache, no-store' always;
}

# HLS segment files
location ~* \.ts$ {
    types {
        video/MP2T ts;
    }
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, Range, Accept, If-Range' always;
    add_header 'Accept-Ranges' 'bytes' always;
    add_header 'Cache-Control' 'public, max-age=31536000' always;
}

# MP4 files
location ~* \.mp4$ {
    types {
        video/mp4 mp4;
    }
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Accept-Ranges' 'bytes' always;
    add_header 'Cache-Control' 'public, max-age=31536000' always;
}

# Handle OPTIONS preflight
location ~* \.(m3u8|ts|mp4)$ {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }
}
```

### Apache .htaccess

```apache
# MIME Types
AddType application/vnd.apple.mpegurl .m3u8
AddType video/MP2T .ts
AddType video/mp4 .mp4

# CORS Headers
<IfModule mod_headers.c>
    <FilesMatch "\.(m3u8|ts|mp4)$">
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
        Header set Access-Control-Allow-Headers "Origin, Range, Accept, If-Range"
    </FilesMatch>
    
    <FilesMatch "\.m3u8$">
        Header set Cache-Control "no-cache, no-store"
    </FilesMatch>
    
    <FilesMatch "\.(ts|mp4)$">
        Header set Accept-Ranges "bytes"
        Header set Cache-Control "public, max-age=31536000"
    </FilesMatch>
</IfModule>
```

---

## iOS PWA / Home Screen Configuration

### Web App Manifest (manifest.json)

```json
{
  "name": "AnimeSavi",
  "short_name": "AnimeSavi",
  "description": "Watch Anime in Hindi DUB",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### index.html Meta Tags for iOS

```html
<head>
  <!-- iOS PWA Meta Tags -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="AnimeSavi">
  
  <!-- Viewport for video -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  
  <!-- iOS icons -->
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
  <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167.png">
  
  <!-- Manifest -->
  <link rel="manifest" href="/manifest.json">
</head>
```

---

## Autoplay Restrictions on iOS

### Key Rules

1. **Muted autoplay is allowed** - Videos can autoplay if muted
2. **Unmute requires user gesture** - Must tap to enable sound
3. **Low Power Mode** - May prevent autoplay entirely
4. **Data Saver Mode** - May prevent preloading

### Implementation Strategy

```javascript
// Try autoplay with sound first
video.play().catch((error) => {
  // Autoplay with sound blocked, try muted
  video.muted = true;
  video.play().then(() => {
    // Show "tap to unmute" UI
    showUnmuteButton();
  });
});
```

---

## Testing Checklist

### Encoding Verification
- [ ] Video codec is H.264 (libx264)
- [ ] Audio codec is AAC
- [ ] Profile is Baseline or Main (not High)
- [ ] Level is 3.1 or 4.0
- [ ] Pixel format is yuv420p
- [ ] MP4 has faststart flag

### Device Testing
- [ ] iPhone Safari
- [ ] iPhone Home Screen (PWA mode)
- [ ] iPad Safari
- [ ] iPad Home Screen (PWA mode)
- [ ] Android Chrome
- [ ] Android Home Screen (PWA mode)
- [ ] Desktop Chrome/Firefox/Safari/Edge

### Playback Features
- [ ] Video starts (muted autoplay OK)
- [ ] Seeking works
- [ ] Quality switching works (HLS)
- [ ] Inline playback (not forced fullscreen)
- [ ] Fullscreen toggle works
- [ ] Audio unmute works after tap

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Black screen on iOS | Re-encode with Baseline profile |
| No audio on iOS | Convert audio to AAC-LC |
| Forced fullscreen | Add `playsinline` attribute |
| Autoplay blocked | Start muted, show unmute button |
| Buffering on cellular | Use adaptive HLS with 360p variant |
| CORS errors | Configure server headers |
| PWA video won't load | Check manifest and service worker |

---

## Quick Command Reference

### Verify Video Encoding
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,level,pix_fmt \
  -of default=noprint_wrappers=1 video.mp4
```

### Expected Output (iOS Compatible)
```
codec_name=h264
profile=Baseline
level=31
pix_fmt=yuv420p
```

### Batch Convert All MKV Files
```bash
for f in *.mkv; do
  ffmpeg -i "$f" \
    -c:v libx264 -profile:v baseline -level:v 3.1 \
    -preset fast -crf 23 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "${f%.mkv}.mp4"
done
```
