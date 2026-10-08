// Service workers stop after ~30 s idle, so keep state in chrome.storage, never in module variables.
chrome.runtime.onInstalled.addListener(async () => {
  const { clicks } = await chrome.storage.local.get('clicks');
  if (clicks === undefined) await chrome.storage.local.set({ clicks: 0 });
});
