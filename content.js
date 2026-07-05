console.log("[IG Better Player] content.js carregado");

const DEFAULT_SETTINGS = {
  volume: 0.8,
  playbackRate: 1,
  skipSeconds: 5,
  rememberVolume: true
};

let settings = { ...DEFAULT_SETTINGS };
let activeVideo = null;
let controls = null;
let hideTimer = null;
let extensionControlsAudio = false;
let desiredVolume = DEFAULT_SETTINGS.volume;
let desiredMuted = false;

chrome.storage.sync.get(
  {
    ...DEFAULT_SETTINGS,
    extensionControlsAudio: false,
    desiredVolume: DEFAULT_SETTINGS.volume,
    desiredMuted: false
  },
  (stored) => {
    settings = stored;

    extensionControlsAudio = stored.extensionControlsAudio;
    desiredVolume = stored.desiredVolume;
    desiredMuted = stored.desiredMuted;

    createFloatingControls();
    startTracking();
    setupKeyboardShortcuts();
  }
);

function takeAudioControl(video, nextVolume, nextMuted) {
  extensionControlsAudio = true;

  desiredVolume = clampVolume(nextVolume);
  desiredMuted = Boolean(nextMuted);

  settings.volume = desiredVolume;

  applyDesiredAudioState(video);

  chrome.storage.sync.set({
    extensionControlsAudio,
    desiredVolume,
    desiredMuted,
    volume: desiredVolume
  });

  console.log("[IG Better Player] áudio controlado pela extensão:", {
    desiredVolume,
    desiredMuted
  });
}

function applyDesiredAudioState(video) {
  if (!video || !extensionControlsAudio) return;

  video.volume = clampVolume(desiredVolume);
  video.muted = desiredMuted || desiredVolume === 0;
}

function clampVolume(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.volume;

  return Math.min(1, Math.max(0, number));
}

function createFloatingControls() {
  if (controls) return;

  controls = document.createElement("div");
  controls.className = "igbp-floating-controls igbp-hidden";

  const playButton = createButton("▶", "Play/Pause");

  const progress = document.createElement("input");
  progress.type = "range";
  progress.min = "0";
  progress.max = "1000";
  progress.value = "0";
  progress.className = "igbp-progress";

  const timeLabel = document.createElement("span");
  timeLabel.className = "igbp-time";
  timeLabel.textContent = "00:00 / 00:00";

  const muteButton = createButton("🔊", "Mute");

  const volume = document.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "1";
  volume.step = "0.01";
  volume.value = String(settings.volume);
  volume.className = "igbp-volume";

  const volumeLabel = document.createElement("span");
  volumeLabel.className = "igbp-volume-label";
  volumeLabel.textContent = `${Math.round(settings.volume * 100)}%`;

  const speed = document.createElement("select");
  speed.className = "igbp-speed";

  [0.5, 1, 1.25, 1.5, 2].forEach((rate) => {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${rate}x`;
    if (rate === settings.playbackRate) option.selected = true;
    speed.appendChild(option);
  });

  controls.append(
    playButton,
    progress,
    timeLabel,
    muteButton,
    volume,
    volumeLabel,
    speed
  );

  document.body.appendChild(controls);

  controls.addEventListener("mouseenter", () => {
    showControls();
  });

  controls.addEventListener("mouseleave", () => {
    scheduleHideControls();
  });

  playButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!activeVideo) return;

    activeVideo.paused ? activeVideo.play() : activeVideo.pause();
  });

  muteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!activeVideo) return;

    const nextMuted = !activeVideo.muted;
    const nextVolume =
      !nextMuted && activeVideo.volume === 0
        ? desiredVolume || settings.volume || 0.8
        : activeVideo.volume;

    takeAudioControl(activeVideo, nextVolume, nextMuted);

    syncControlsWithVideo(activeVideo);
    showControls();
  });

  progress.addEventListener("input", (event) => {
    event.stopPropagation();
    if (!activeVideo) return;

    if (!Number.isFinite(activeVideo.duration) || activeVideo.duration <= 0) {
      return;
    }

    activeVideo.currentTime =
      activeVideo.duration * (Number(progress.value) / 1000);

    showControls();
  });

  volume.addEventListener("input", (event) => {
    event.stopPropagation();
    if (!activeVideo) return;

    const nextVolume = Number(volume.value);

    takeAudioControl(activeVideo, nextVolume, nextVolume === 0);

    syncControlsWithVideo(activeVideo);
    showControls();

    console.log("[IG Better Player] volume aplicado:", {
        volume: activeVideo.volume,
        muted: activeVideo.muted
    });
  });

  speed.addEventListener("change", (event) => {
    event.stopPropagation();
    if (!activeVideo) return;

    const rate = Number(speed.value);

    activeVideo.playbackRate = rate;
    settings.playbackRate = rate;

    chrome.storage.sync.set({ playbackRate: rate });

    showControls();
  });

  controls.__igbp = {
    playButton,
    progress,
    timeLabel,
    muteButton,
    volume,
    volumeLabel,
    speed
  };
}

function startTracking() {
  setInterval(() => {
    const video = getMostRelevantVideo();

    if (!video) {
      hideControlsImmediately();
      activeVideo = null;
      return;
    }

    if (video !== activeVideo) {
      bindVideo(video);
    }

    if (extensionControlsAudio) {
      applyDesiredAudioState(video);
    }

    positionControls(video);
    syncControlsWithVideo(video);
  }, 200);
}

function bindVideo(video) {
  activeVideo = video;

  activeVideo.playbackRate = settings.playbackRate;

  if (extensionControlsAudio) {
    applyDesiredAudioState(activeVideo);
  }

  activeVideo.addEventListener("volumechange", () => {
    if (!extensionControlsAudio) return;

    /**
     * O Instagram às vezes remuta/redefine volume logo depois que o Reel entra.
     * Quando a extensão já assumiu o áudio, reaplicamos o estado desejado.
     */
    const volumeMismatch =
      Math.abs(activeVideo.volume - desiredVolume) > 0.01;

    const mutedMismatch =
      activeVideo.muted !== (desiredMuted || desiredVolume === 0);

    if (volumeMismatch || mutedMismatch) {
      queueMicrotask(() => {
        applyDesiredAudioState(activeVideo);
        syncControlsWithVideo(activeVideo);
      });
    }
  });

  activeVideo.addEventListener("play", () => {
    if (extensionControlsAudio) {
      applyDesiredAudioState(activeVideo);
      syncControlsWithVideo(activeVideo);
    }
  });

  console.log("[IG Better Player] vídeo ativo:", {
    video: activeVideo,
    volume: activeVideo.volume,
    muted: activeVideo.muted,
    duration: activeVideo.duration,
    extensionControlsAudio
  });
}

window.__igbpMouse = null;

document.addEventListener(
  "mousemove",
  (event) => {
    window.__igbpMouse = {
      x: event.clientX,
      y: event.clientY
    };

    handleMouseVisibility();
  },
  { passive: true }
);

document.addEventListener(
  "mouseleave",
  () => {
    hideControlsImmediately();
  },
  { passive: true }
);

window.addEventListener(
  "blur",
  () => {
    hideControlsImmediately();
  },
  { passive: true }
);

function handleMouseVisibility() {
  if (!activeVideo || !controls || !window.__igbpMouse) {
    hideControlsImmediately();
    return;
  }

  const mouse = window.__igbpMouse;
  const videoRect = activeVideo.getBoundingClientRect();
  const controlsRect = controls.getBoundingClientRect();

  const isOverVideo =
    mouse.x >= videoRect.left &&
    mouse.x <= videoRect.right &&
    mouse.y >= videoRect.top &&
    mouse.y <= videoRect.bottom;

  const isOverControls =
    mouse.x >= controlsRect.left &&
    mouse.x <= controlsRect.right &&
    mouse.y >= controlsRect.top &&
    mouse.y <= controlsRect.bottom;

  if (isOverVideo || isOverControls) {
    showControls();
    return;
  }

  scheduleHideControls();
}

function showControls() {
  if (!controls) return;

  clearTimeout(hideTimer);

  controls.classList.remove("igbp-hidden");
  controls.classList.add("igbp-visible");
}

function scheduleHideControls() {
  clearTimeout(hideTimer);

  hideTimer = setTimeout(() => {
    if (!isMouseOverActiveArea()) {
      controls.classList.remove("igbp-visible");
      controls.classList.add("igbp-hidden");
    }
  }, 10);
}

function hideControlsImmediately() {
  if (!controls) return;

  clearTimeout(hideTimer);

  controls.classList.remove("igbp-visible");
  controls.classList.add("igbp-hidden");
}

function isMouseOverControls() {
  if (!controls || !window.__igbpMouse) return false;

  const rect = controls.getBoundingClientRect();
  const mouse = window.__igbpMouse;

  return (
    mouse.x >= rect.left &&
    mouse.x <= rect.right &&
    mouse.y >= rect.top &&
    mouse.y <= rect.bottom
  );
}

function isMouseOverActiveArea() {
  if (!activeVideo || !controls || !window.__igbpMouse) return false;

  const mouse = window.__igbpMouse;
  const videoRect = activeVideo.getBoundingClientRect();
  const controlsRect = controls.getBoundingClientRect();

  const isOverVideo =
    mouse.x >= videoRect.left &&
    mouse.x <= videoRect.right &&
    mouse.y >= videoRect.top &&
    mouse.y <= videoRect.bottom;

  const isOverControls =
    mouse.x >= controlsRect.left &&
    mouse.x <= controlsRect.right &&
    mouse.y >= controlsRect.top &&
    mouse.y <= controlsRect.bottom;

  return isOverVideo || isOverControls;
}

function positionControls(video) {
  if (!controls) return;

  const rect = video.getBoundingClientRect();

  controls.style.left = `${Math.max(8, rect.left + 8)}px`;
  controls.style.width = `${Math.max(260, rect.width - 16)}px`;
  controls.style.top = `${Math.max(8, rect.bottom - 58)}px`;
}

function syncControlsWithVideo(video) {
  if (!controls) return;

  const {
    playButton,
    progress,
    timeLabel,
    muteButton,
    volume,
    volumeLabel,
    speed
  } = controls.__igbp;

  playButton.textContent = video.paused ? "▶" : "⏸";
  muteButton.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";

  volume.value = String(video.muted ? 0 : video.volume);

  if (video.muted) {
    volumeLabel.textContent = "0%";
  } else {
    volumeLabel.textContent = `${Math.round(video.volume * 100)}%`;
  }

  speed.value = String(video.playbackRate);

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    progress.value = "0";
    timeLabel.textContent = "00:00 / 00:00";
    return;
  }

  progress.value = String(
    Math.round((video.currentTime / video.duration) * 1000)
  );

  timeLabel.textContent =
    `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
}

function createButton(text, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = label;
  button.className = "igbp-button";
  return button;
}

function getMostRelevantVideo() {
  const videos = [...document.querySelectorAll("video")];

  const visibleVideos = videos.filter((video) => {
    const rect = video.getBoundingClientRect();

    return (
      rect.width > 100 &&
      rect.height > 100 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  });

  if (!visibleVideos.length) return null;

  return visibleVideos.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();

    const aCenterDistance = Math.abs(
      aRect.top + aRect.height / 2 - window.innerHeight / 2
    );

    const bCenterDistance = Math.abs(
      bRect.top + bRect.height / 2 - window.innerHeight / 2
    );

    return aCenterDistance - bCenterDistance;
  })[0];
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;

    if (
      active &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
    ) {
      return;
    }

    if (!activeVideo) return;

    switch (event.key.toLowerCase()) {
      case " ":
        event.preventDefault();
        activeVideo.paused ? activeVideo.play() : activeVideo.pause();
        showControls();
        break;

      case "arrowleft":
        event.preventDefault();
        activeVideo.currentTime = Math.max(
          0,
          activeVideo.currentTime - settings.skipSeconds
        );
        showControls();
        break;

      case "arrowright":
        event.preventDefault();
        activeVideo.currentTime = Math.min(
          activeVideo.duration || Infinity,
          activeVideo.currentTime + settings.skipSeconds
        );
        showControls();
        break;

      case "arrowup":
        event.preventDefault();

        takeAudioControl(
          activeVideo,
          Math.min(
            1,
            (activeVideo.muted ? desiredVolume : activeVideo.volume) + 0.05
          ),
          false
        );

        syncControlsWithVideo(activeVideo);
        showControls();
        break;

      case "arrowdown":
        event.preventDefault();

        {
          const baseVolume = activeVideo.muted ? desiredVolume : activeVideo.volume;
          const nextVolume = Math.max(0, baseVolume - 0.05);

          takeAudioControl(activeVideo, nextVolume, nextVolume === 0);
        }

        syncControlsWithVideo(activeVideo);
        showControls();
        break;

      case "m":
        event.preventDefault();

        {
          const nextMuted = !activeVideo.muted;
          const nextVolume =
            !nextMuted && activeVideo.volume === 0
              ? desiredVolume || settings.volume || 0.8
              : activeVideo.volume;

          takeAudioControl(activeVideo, nextVolume, nextMuted);
        }

        syncControlsWithVideo(activeVideo);
        showControls();
        break;
      default:
        break;
    }
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}