console.log("[EXT] smart content.js loaded");

function parseDuration(text) {
  const parts = text.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? h + "h " : ""}${m || h ? m + "m " : ""}${s}s`.trim();
}

function getVideoId(href) {
  try {
    return new URL(href, location.origin).searchParams.get("v");
  } catch {
    return href.match(/[?&]v=([^&]+)/)?.[1];
  }
}

function collectVideos() {
  const videos = new Map();
  const selectors = [
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer"
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(item => {
      const link = item.querySelector('a[href*="/watch"]');
      const videoId = link && getVideoId(link.href);
      const duration = item.querySelector(".yt-badge-shape__text, #text")?.textContent.trim();
      
      if (videoId && duration) videos.set(videoId, duration);
    });
  });

  return videos;
}

async function collectAll() {
  let lastCount = 0, stable = 0;
  const data = new Map();

  for (let i = 0; i < 20 && stable < 2; i++) {
    collectVideos().forEach((v, k) => data.set(k, v));
    console.log(`[EXT] Attempt ${i + 1}: ${data.size} videos`);
    
    if (data.size === lastCount) stable++;
    else { lastCount = data.size; stable = 0; }
    
    await new Promise(r => setTimeout(r, 400));
  }

  return data;
}

async function findHeader() {
  for (let i = 0; i < 20; i++) {
    const header = document.querySelector(
      "ytd-playlist-panel-renderer yt-formatted-string.title a, " +
      "ytd-playlist-panel-renderer a[href*='playlist?list=']"
    );
    if (header) return header;
    await new Promise(r => setTimeout(r, 300));
  }
}

async function insertDuration() {
  if (!location.href.includes("list=")) return;

  console.log("[EXT] collecting durations...");
  const videos = await collectAll();
  
  const totalSec = Array.from(videos.values()).reduce((sum, dur) => 
    sum + parseDuration(dur), 0
  );
  
  console.log(`[EXT] ${videos.size} videos, total = ${formatTime(totalSec)}`);

  const header = await findHeader();
  if (!header) return console.warn("[EXT] header not found");

  const container = header.closest("ytd-playlist-panel-renderer") || header.parentElement;
  if (!container) return console.warn("[EXT] container not found");

  container.querySelector(".total-duration-label")?.remove();

  const label = document.createElement("div");
  label.className = "total-duration-label";
  Object.assign(label.style, {
    marginTop: "6px",
    color: "#00994d",
    fontSize: "13px",
    fontWeight: "700"
  });
  label.textContent = `Duration: ${formatTime(totalSec)} • ${videos.size} videos`;
  
  container.appendChild(label);
  console.log("[EXT] duration inserted");
}

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log("[EXT] URL changed =>", lastUrl);
    setTimeout(insertDuration, 800);
  }
}).observe(document, { childList: true, subtree: true });

window.addEventListener("load", () => setTimeout(insertDuration, 800));
setTimeout(() => location.href.includes("list=") && insertDuration(), 1200);