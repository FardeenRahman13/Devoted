const params = new URLSearchParams(location.search);
const domain = params.get("site") || "this site";
const label = params.get("label") || domain;

document.getElementById("site-name").textContent = `${label} is blocked`;
document.getElementById("site-domain").textContent = label;
document.title = `Blocked — ${label}`;

// --- Theme, synced with the popup via chrome.storage ---
(async () => {
  const { settings } = await chrome.storage.sync.get(["settings"]);
  document.documentElement.dataset.theme = (settings && settings.theme) || "dark";
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    const theme = changes.settings.newValue?.theme || "dark";
    document.documentElement.dataset.theme = theme;
  }
});

// --- Subtle cursor-tracked glow, so the background isn't flat ---
(() => {
  const glowField = document.getElementById("glow-field");
  window.addEventListener("mousemove", (e) => {
    const xPct = (e.clientX / window.innerWidth) * 100;
    const yPct = (e.clientY / window.innerHeight) * 100;
    glowField.style.setProperty("--mx", `${xPct}%`);
    glowField.style.setProperty("--my", `${yPct}%`);
  });
})();

const PHRASES = [
  "I choose focus over this scroll",
  "This can wait until my session ends",
  "My attention is worth protecting",
  "Later versions of me will thank me",
  "I am the one who set this block"
];
const challenge = PHRASES[Math.floor(Math.random() * PHRASES.length)];
document.getElementById("challenge-phrase").textContent = challenge;

(async () => {
  const { settings } = await chrome.storage.sync.get(["settings"]);
  const locked = settings && settings.focusEndsAt && settings.focusEndsAt > Date.now();
  if (locked) {
    const body = document.querySelector(".override-body");
    const mins = Math.ceil((settings.focusEndsAt - Date.now()) / 60000);
    body.innerHTML = `<p>You're in a locked focus session with about ${mins} minute${mins === 1 ? "" : "s"} left. No early unlocks — that's the point.</p>`;
  }
})();

document.getElementById("unlock-form").addEventListener("submit", async (e) => {
  const { settings } = await chrome.storage.sync.get(["settings"]);
  if (settings && settings.focusEndsAt && settings.focusEndsAt > Date.now()) {
    return; // locked session — form has already been replaced with a message
  }
  e.preventDefault();
  const input = document.getElementById("unlock-input");
  const mismatch = document.getElementById("mismatch");

  if (input.value.trim().toLowerCase() !== challenge.trim().toLowerCase()) {
    mismatch.textContent = "That doesn't match. Take a breath and try again if you're sure.";
    return;
  }

  const data = await chrome.storage.sync.get(["unlockedUntil"]);
  const unlockedUntil = data.unlockedUntil ?? {};
  unlockedUntil[domain] = Date.now() + 5 * 60 * 1000;
  await chrome.storage.sync.set({ unlockedUntil });

  mismatch.style.color = "#7c3aed";
  mismatch.textContent = "Unlocked for 5 minutes. Redirecting…";
  setTimeout(() => {
    location.href = `https://${domain}`;
  }, 700);
});
