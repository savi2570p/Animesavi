import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';

interface EmbedFallbackFrameProps {
  primaryUrl: string;
  alternateUrl: string | null;
  title: string;
  onBackToNative: () => void;
  isFullscreen: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

const AUTO_RETRY_TIMEOUT_MS = 6000;
const MAX_AUTO_RETRIES = 3;

function buildEmbedHtml(url: string): string {
  const safeUrl = url.replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#000;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;user-select:none}
.wrap{position:relative;width:100%;height:100%;background:#000}
video{width:100%;height:100%;object-fit:contain;background:#000;display:block}
.overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;pointer-events:none;transition:opacity .25s ease;background:linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,.25) 25%,transparent 50%)}
.overlay.hidden{opacity:0}
.overlay > *{pointer-events:auto}
.center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.center button{pointer-events:auto;width:64px;height:64px;border-radius:9999px;background:rgba(255,255,255,.15);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;transition:transform .15s ease,background .2s ease}
.center button:hover{background:rgba(255,255,255,.22);transform:scale(1.06)}
.center button.hide{display:none}
.spinner{width:44px;height:44px;border-radius:9999px;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.bar{padding:8px 14px 10px;display:flex;flex-direction:column;gap:6px}
.seek{position:relative;height:18px;display:flex;align-items:center;cursor:pointer;touch-action:none}
.seek .track{position:relative;width:100%;height:3px;border-radius:9999px;background:rgba(255,255,255,.22);overflow:visible}
.seek .buffered{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.35);border-radius:9999px;width:0}
.seek .played{position:absolute;left:0;top:0;bottom:0;background:#e11d48;border-radius:9999px;width:0}
.seek .thumb{position:absolute;top:50%;width:12px;height:12px;border-radius:9999px;background:#fff;transform:translate(-50%,-50%) scale(0);transition:transform .15s ease;box-shadow:0 2px 6px rgba(0,0,0,.5);left:0}
.seek:hover .track,.seek.active .track{height:4px}
.seek:hover .thumb,.seek.active .thumb{transform:translate(-50%,-50%) scale(1)}
.row{display:flex;align-items:center;gap:6px;color:#fff}
.icon-btn{background:transparent;border:0;color:#fff;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border-radius:8px;opacity:.9;transition:opacity .15s,background .15s}
.icon-btn:hover{opacity:1;background:rgba(255,255,255,.08)}
.time{font-size:12px;font-variant-numeric:tabular-nums;opacity:.85;margin-left:4px;letter-spacing:.2px}
.spacer{flex:1}
.menu{position:absolute;right:12px;bottom:56px;min-width:220px;max-height:60vh;overflow:auto;background:rgba(15,15,18,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;display:none;box-shadow:0 12px 40px rgba(0,0,0,.6)}
.menu.open{display:block}
.menu h4{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.55);padding:8px 10px 4px;font-weight:600}
.menu button{width:100%;text-align:left;background:transparent;border:0;color:#fff;padding:8px 10px;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px}
.menu button:hover{background:rgba(255,255,255,.08)}
.menu button.active{background:rgba(225,29,72,.25);color:#fff}
.menu .check{margin-left:auto;opacity:.9}
.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;background:rgba(0,0,0,.7);text-align:center;padding:20px}
:fullscreen video,:-webkit-full-screen video{width:100%;height:100%}
</style></head><body>
<div class="wrap" id="wrap">
  <video id="v" src="${safeUrl}" autoplay playsinline crossorigin="anonymous" preload="metadata"></video>
  <div class="center" id="center"><div id="centerInner" class="spinner"></div></div>
  <div class="overlay" id="overlay">
    <div class="bar">
      <div class="seek" id="seek">
        <div class="track"><div class="buffered" id="buf"></div><div class="played" id="pl"></div><div class="thumb" id="thumb"></div></div>
      </div>
      <div class="row">
        <button class="icon-btn" id="playBtn" aria-label="Play">
          <svg id="playIcon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <span class="time" id="time">0:00 / 0:00</span>
        <div class="spacer"></div>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button class="icon-btn" id="fsBtn" aria-label="Fullscreen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>
  </div>
  <div class="menu" id="menu"></div>
</div>
<script>(function(){
var v=document.getElementById('v'),wrap=document.getElementById('wrap'),overlay=document.getElementById('overlay'),center=document.getElementById('center'),centerInner=document.getElementById('centerInner'),seek=document.getElementById('seek'),buf=document.getElementById('buf'),pl=document.getElementById('pl'),thumb=document.getElementById('thumb'),timeEl=document.getElementById('time'),playBtn=document.getElementById('playBtn'),playIcon=document.getElementById('playIcon'),fsBtn=document.getElementById('fsBtn'),settingsBtn=document.getElementById('settingsBtn'),menu=document.getElementById('menu');
var reported=false,hideTimer=null,scrubbing=false;
function report(r){if(reported)return;reported=true;try{parent.postMessage({type:'embed-fallback-error',reason:r},'*');}catch(e){}}
v.addEventListener('error',function(){report('video-error');});
v.addEventListener('loadedmetadata',function(){try{parent.postMessage({type:'embed-fallback-ready'},'*');}catch(e){}renderMenu();});
setTimeout(function(){if(!v.readyState)report('load-timeout');},6000);
function fmt(s){if(!isFinite(s))return '0:00';s=Math.max(0,s|0);var m=(s/60)|0,ss=s%60;var h=(m/60)|0;m=m%60;return (h?h+':'+(m<10?'0':''):'')+m+':'+(ss<10?'0':'')+ss;}
function setPlayIcon(playing){playIcon.innerHTML=playing?'<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>':'<path d="M8 5v14l11-7z"/>';playBtn.setAttribute('aria-label',playing?'Pause':'Play');}
function updateBuffered(){try{if(v.buffered.length&&v.duration){var end=v.buffered.end(v.buffered.length-1);buf.style.width=(end/v.duration*100)+'%';}}catch(e){}}
function updateProgress(){if(!v.duration)return;var p=v.currentTime/v.duration*100;pl.style.width=p+'%';thumb.style.left=p+'%';timeEl.textContent=fmt(v.currentTime)+' / '+fmt(v.duration);updateBuffered();}
v.addEventListener('timeupdate',updateProgress);v.addEventListener('progress',updateBuffered);v.addEventListener('durationchange',updateProgress);
v.addEventListener('play',function(){setPlayIcon(true);hideCenter();scheduleHide();});
v.addEventListener('pause',function(){setPlayIcon(false);showOverlay();});
v.addEventListener('waiting',function(){centerInner.className='spinner';centerInner.innerHTML='';center.style.display='flex';});
v.addEventListener('playing',function(){hideCenter();});
v.addEventListener('canplay',function(){hideCenter();});
function hideCenter(){if(!v.paused){center.style.display='none';}}
function showOverlay(){overlay.classList.remove('hidden');if(hideTimer){clearTimeout(hideTimer);hideTimer=null;}}
function scheduleHide(){if(hideTimer)clearTimeout(hideTimer);if(v.paused)return;hideTimer=setTimeout(function(){overlay.classList.add('hidden');menu.classList.remove('open');},2600);}
wrap.addEventListener('mousemove',function(){showOverlay();scheduleHide();});
wrap.addEventListener('touchstart',function(){showOverlay();scheduleHide();},{passive:true});
function togglePlay(){if(v.paused){v.play().catch(function(){});}else{v.pause();}}
playBtn.addEventListener('click',function(e){e.stopPropagation();togglePlay();});
v.addEventListener('click',togglePlay);
// Seek
function seekAt(clientX){var r=seek.getBoundingClientRect();var x=Math.min(Math.max(0,clientX-r.left),r.width);var p=x/r.width;if(v.duration){v.currentTime=p*v.duration;pl.style.width=(p*100)+'%';thumb.style.left=(p*100)+'%';}}
function down(e){scrubbing=true;seek.classList.add('active');var x=e.touches?e.touches[0].clientX:e.clientX;seekAt(x);showOverlay();}
function move(e){if(!scrubbing)return;var x=e.touches?e.touches[0].clientX:e.clientX;seekAt(x);e.preventDefault();}
function up(){scrubbing=false;seek.classList.remove('active');scheduleHide();}
seek.addEventListener('mousedown',down);window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
seek.addEventListener('touchstart',down,{passive:true});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);
// Fullscreen
fsBtn.addEventListener('click',function(e){e.stopPropagation();var el=wrap;var req=el.requestFullscreen||el.webkitRequestFullscreen||el.webkitEnterFullscreen;var exit=document.exitFullscreen||document.webkitExitFullscreen;if(document.fullscreenElement||document.webkitFullscreenElement){exit&&exit.call(document);}else if(v.webkitEnterFullscreen&&!req){v.webkitEnterFullscreen();}else{req&&req.call(el);}try{parent.postMessage({type:'embed-fallback-fullscreen'},'*');}catch(e){}});
// Settings menu (quality via videoTracks unsupported for plain mp4 — offer playbackRate + audio tracks if available)
function renderMenu(){var html='';var qualities=[{v:'auto',l:'Auto (source)'}];var rates=[0.5,0.75,1,1.25,1.5,2];html+='<h4>Playback Speed</h4>';rates.forEach(function(r){html+='<button data-rate="'+r+'"'+(v.playbackRate===r?' class="active"':'')+'>'+r+'x'+(v.playbackRate===r?'<span class="check">✓</span>':'')+'</button>';});// Audio tracks
if(v.audioTracks&&v.audioTracks.length>1){html+='<h4>Audio</h4>';for(var i=0;i<v.audioTracks.length;i++){var t=v.audioTracks[i];html+='<button data-audio="'+i+'"'+(t.enabled?' class="active"':'')+'>'+(t.label||t.language||('Track '+(i+1)))+'</button>';}}
// Text tracks
if(v.textTracks&&v.textTracks.length){html+='<h4>Subtitles</h4><button data-cc="-1"'+(![].some.call(v.textTracks,function(t){return t.mode==='showing';})?' class="active"':'')+'>Off</button>';for(var j=0;j<v.textTracks.length;j++){var tt=v.textTracks[j];html+='<button data-cc="'+j+'"'+(tt.mode==='showing'?' class="active"':'')+'>'+(tt.label||tt.language||('Sub '+(j+1)))+'</button>';}}
html+='<h4>Quality</h4>'+qualities.map(function(q){return '<button data-q="'+q.v+'" class="active">'+q.l+'<span class="check">✓</span></button>';}).join('');
menu.innerHTML=html;}
settingsBtn.addEventListener('click',function(e){e.stopPropagation();renderMenu();menu.classList.toggle('open');showOverlay();});
menu.addEventListener('click',function(e){var t=e.target.closest('button');if(!t)return;e.stopPropagation();if(t.dataset.rate){v.playbackRate=parseFloat(t.dataset.rate);}else if(t.dataset.audio&&v.audioTracks){var idx=+t.dataset.audio;for(var i=0;i<v.audioTracks.length;i++)v.audioTracks[i].enabled=(i===idx);}else if(t.dataset.cc){var ci=+t.dataset.cc;for(var j=0;j<v.textTracks.length;j++)v.textTracks[j].mode=(j===ci?'showing':'disabled');}renderMenu();});
document.addEventListener('click',function(e){if(!menu.contains(e.target)&&e.target!==settingsBtn&&!settingsBtn.contains(e.target)){menu.classList.remove('open');}});
setPlayIcon(!v.paused);showOverlay();scheduleHide();
})();</script>
</body></html>`;
}

export function EmbedFallbackFrame({
  primaryUrl,
  alternateUrl,
  title,
  onBackToNative,
  isFullscreen,
  containerRef,
}: EmbedFallbackFrameProps) {
  const [currentUrl, setCurrentUrl] = useState(primaryUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'retrying' | 'failed'>('loading');
  const [lastReason, setLastReason] = useState<string | null>(null);
  const readyRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const clearWatchdog = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const triggerRetry = useCallback(
    (reason: string) => {
      if (readyRef.current) return;
      setLastReason(reason);
      setAttempt((prev) => {
        const next = prev + 1;
        if (next > MAX_AUTO_RETRIES) {
          setStatus('failed');
          clearWatchdog();
          console.warn('[EmbedFallback] gave up after retries', { reason, currentUrl });
          return prev;
        }
        setStatus('retrying');
        console.warn('[EmbedFallback] auto-retry', { reason, next, currentUrl });
        if (next === 1 || !alternateUrl) {
          setReloadKey((k) => k + 1);
        } else {
          setCurrentUrl((u) => (u === primaryUrl && alternateUrl ? alternateUrl : primaryUrl));
          setReloadKey((k) => k + 1);
        }
        return next;
      });
    },
    [alternateUrl, clearWatchdog, currentUrl, primaryUrl],
  );

  const manualReload = useCallback(() => {
    readyRef.current = false;
    setAttempt(0);
    setStatus('loading');
    setLastReason(null);
    setCurrentUrl(primaryUrl);
    setReloadKey((k) => k + 1);
  }, [primaryUrl]);

  useEffect(() => {
    if (status === 'failed') return;
    readyRef.current = false;
    setStatus((s) => (s === 'retrying' ? 'retrying' : 'loading'));
    clearWatchdog();
    timeoutRef.current = window.setTimeout(() => {
      if (!readyRef.current) triggerRetry('load-timeout');
    }, AUTO_RETRY_TIMEOUT_MS);
    return clearWatchdog;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, reloadKey]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; reason?: string } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'embed-fallback-ready') {
        readyRef.current = true;
        clearWatchdog();
        setStatus('ready');
      } else if (data.type === 'embed-fallback-error') {
        triggerRetry(data.reason || 'error');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [clearWatchdog, triggerRetry]);

  const bustedUrl =
    reloadKey > 0
      ? `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}_r=${reloadKey}`
      : currentUrl;
  const embedDoc = buildEmbedHtml(bustedUrl);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black w-full ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
      style={{
        aspectRatio: isFullscreen ? undefined : '16/9',
        maxHeight: isFullscreen ? '100vh' : '70vh',
        height: isFullscreen ? '100vh' : undefined,
      }}
    >
      {status !== 'failed' && (
        <iframe
          key={`${currentUrl}-${reloadKey}`}
          srcDoc={embedDoc}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      )}

      {status === 'retrying' && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 py-1.5 bg-black/70 text-white text-xs font-medium z-10">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Reloading embed player (attempt {attempt}/{MAX_AUTO_RETRIES})…
        </div>
      )}

      {status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 z-20">
          <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-white font-semibold mb-1">Embed player blocked</h3>
            <p className="text-white/70 text-xs mb-4">
              We couldn't load the embed after {MAX_AUTO_RETRIES} attempts
              {lastReason ? ` (${lastReason})` : ''}. Try again, open in a new tab, or go back to the native player.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={manualReload} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload embed player
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(primaryUrl, '_blank', 'noopener,noreferrer')}
                className="w-full text-white border-white/20 bg-white/5 hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
              <Button
                variant="ghost"
                onClick={onBackToNative}
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
              >
                Back to Native Player
              </Button>
            </div>
          </div>
        </div>
      )}

      {status !== 'failed' && (
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <Button
            onClick={manualReload}
            variant="outline"
            size="sm"
            className="text-white border-white/30 bg-black/50 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
          <Button
            onClick={onBackToNative}
            variant="outline"
            size="sm"
            className="text-white border-white/30 bg-black/50 hover:bg-white/10"
          >
            Back to Native
          </Button>
        </div>
      )}
    </div>
  );
}
