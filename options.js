const DEFAULT_SETTINGS = {
  volume: 0.8,
  playbackRate: 1,
  showTips: true,
  skipSeconds: 5
};

const volume = document.querySelector("#volume");
const volumeValue = document.querySelector("#volumeValue");
const playbackRate = document.querySelector("#playbackRate");
const showTips = document.querySelector("#showTips");
const skipSeconds = document.querySelector("#skipSeconds");

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  volume.value = settings.volume;
  volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;
  playbackRate.value = String(settings.playbackRate);
  showTips.checked = settings.showTips;
  skipSeconds.value = settings.skipSeconds;
});

volume.addEventListener("input", () => {
  const value = Number(volume.value);
  volumeValue.textContent = `${Math.round(value * 100)}%`;
  chrome.storage.sync.set({ volume: value });
});

playbackRate.addEventListener("change", () => {
  chrome.storage.sync.set({ playbackRate: Number(playbackRate.value) });
});

showTips.addEventListener("change", () => {
  chrome.storage.sync.set({ showTips: showTips.checked });
});

skipSeconds.addEventListener("input", () => {
  chrome.storage.sync.set({ skipSeconds: Number(skipSeconds.value) });
});