// MV3 forbids inline scripts, so the popup logic lives in this file.
const countEl = document.getElementById('count');
const button = document.getElementById('click');

async function render() {
  const { clicks = 0 } = await chrome.storage.local.get('clicks');
  countEl.textContent = String(clicks);
}

button.addEventListener('click', async () => {
  const { clicks = 0 } = await chrome.storage.local.get('clicks');
  await chrome.storage.local.set({ clicks: clicks + 1 });
  await render();
});

render();
