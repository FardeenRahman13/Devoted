const DEFAULT_SITES = [
  { id: 1, label: "Facebook", domain: "facebook.com", enabled: true, builtin: true },
  { id: 2, label: "YouTube", domain: "youtube.com", enabled: true, builtin: true },
  { id: 3, label: "Twitter / X", domain: "twitter.com", enabled: true, builtin: true },
  { id: 4, label: "Twitter / X", domain: "x.com", enabled: true, builtin: true },
  { id: 5, label: "Instagram", domain: "instagram.com", enabled: true, builtin: true }
];
const DEFAULT_SETTINGS = { masterEnabled: true, focusEndsAt: null, nextRuleId: 100, theme: "dark" };

const els = {
  masterToggle: document.getElementById("master-toggle"),
  beacon: document.getElementById("beacon-dot"),
  statusPill: document.getElementById("status-pill"),
  themeToggle: document.getElementById("theme-toggle"),
  themeIconMoon: document.getElementById("theme-icon-moon"),
  themeIconSun: document.getElementById("theme-icon-sun"),
  status: document.getElementById("status-line"),
  sessionCard: document.getElementById("session-card"),
  sessionTitle: document.getElementById("session-title"),
  sessionSub: document.getElementById("session-sub"),
  sessionActions: document.getElementById("session-actions"),
  siteList: document.getElementById("site-list"),
  addForm: document.getElementById("add-form"),
  addInput: document.getElementById("add-input"),
  addError: document.getElementById("add-error"),
  restoreBtn: document.getElementById("restore-defaults")
};

let countdownTimer = null;

function labelFromDomain(domain) {
  const first = domain.split(".")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function normalizeDomain(raw) {
  let v = raw.trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "");
  v = v.split("/")[0];
  v = v.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null;
  return v;
}

async function getStore() {
  const data = await chrome.storage.sync.get(["sites", "settings", "unlockedUntil"]);
  return {
    sites: data.sites ?? DEFAULT_SITES,
    settings: data.settings ?? DEFAULT_SETTINGS,
    unlockedUntil: data.unlockedUntil ?? {}
  };
}

function setStore(partial) {
  return chrome.storage.sync.set(partial);
}

function fmtRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function render() {
  const { sites, settings } = await getStore();
  const now = Date.now();
  const locked = !!(settings.focusEndsAt && settings.focusEndsAt > now);

  const theme = settings.theme || "dark";
  document.documentElement.dataset.theme = theme;
  els.themeIconMoon.style.display = theme === "dark" ? "block" : "none";
  els.themeIconSun.style.display = theme === "light" ? "block" : "none";

  // Master toggle + beacon + status
  els.masterToggle.checked = settings.masterEnabled;
  els.masterToggle.disabled = locked;
  els.beacon.classList.toggle("active", settings.masterEnabled);
  els.statusPill.textContent = locked ? "locked" : settings.masterEnabled ? "on" : "off";
  els.statusPill.classList.toggle("on", settings.masterEnabled);
  els.status.classList.toggle("locked", locked);

  if (locked) {
    els.status.textContent = `Locked in a focus session — ${fmtRemaining(settings.focusEndsAt - now)} left.`;
  } else if (settings.masterEnabled) {
    els.status.textContent = "Blocking is on.";
  } else {
    els.status.textContent = "Blocking is off.";
  }

  // Session card
  if (locked) {
    els.sessionTitle.textContent = "Focus session running";
    els.sessionSub.textContent = "Sit tight — the lock lifts automatically.";
    els.sessionActions.style.visibility = "hidden";
  } else {
    els.sessionTitle.textContent = "Start a focus session";
    els.sessionSub.textContent = "Blocking stays on for the full time — you won't be able to turn it off early.";
    els.sessionActions.style.visibility = "visible";
  }

  // Site list
  els.siteList.innerHTML = "";
  for (const site of sites) {
    const li = document.createElement("li");
    li.className = "site-row";

    const lockThisRow = locked && site.enabled; // can't loosen mid-session

    li.innerHTML = `
      <div class="site-info">
        <span class="site-label">${escapeHtml(site.label)}</span>
        <span class="site-domain">${escapeHtml(site.domain)}</span>
      </div>
      <label class="mini-switch">
        <input type="checkbox" ${site.enabled ? "checked" : ""} ${lockThisRow ? "disabled" : ""} data-id="${site.id}" class="site-toggle" />
        <span class="mini-track"><span class="mini-thumb"></span></span>
      </label>
      <button class="remove-btn" data-id="${site.id}" ${lockThisRow ? "disabled" : ""} title="Remove">✕</button>
    `;
    els.siteList.appendChild(li);
  }

  // wire up row events
  els.siteList.querySelectorAll(".site-toggle").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const id = Number(e.target.dataset.id);
      const store = await getStore();
      const updated = store.sites.map((s) => (s.id === id ? { ...s, enabled: e.target.checked } : s));
      await setStore({ sites: updated });
    });
  });
  els.siteList.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);
      const store = await getStore();
      const updated = store.sites.filter((s) => s.id !== id);
      await setStore({ sites: updated });
    });
  });

  restartCountdown();
}

function restartCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    const { settings } = await getStore();
    const now = Date.now();
    if (settings.focusEndsAt && settings.focusEndsAt > now) {
      els.status.textContent = `Locked in a focus session — ${fmtRemaining(settings.focusEndsAt - now)} left.`;
    } else if (settings.focusEndsAt) {
      // just expired
      clearInterval(countdownTimer);
      render();
    }
  }, 1000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Event wiring ---

els.themeToggle.addEventListener("click", async () => {
  const { settings } = await getStore();
  const next = (settings.theme || "dark") === "dark" ? "light" : "dark";
  await setStore({ settings: { ...settings, theme: next } });
  render();
});

els.masterToggle.addEventListener("change", async (e) => {
  const { settings } = await getStore();
  await setStore({ settings: { ...settings, masterEnabled: e.target.checked } });
  render();
});

els.sessionActions.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", async () => {
    const mins = Number(chip.dataset.mins);
    const { settings } = await getStore();
    await setStore({
      settings: { ...settings, masterEnabled: true, focusEndsAt: Date.now() + mins * 60 * 1000 }
    });
    render();
  });
});

els.addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.addError.textContent = "";
  const domain = normalizeDomain(els.addInput.value);
  if (!domain) {
    els.addError.textContent = "Enter a valid domain, like reddit.com";
    return;
  }
  const store = await getStore();
  if (store.sites.some((s) => s.domain === domain)) {
    els.addError.textContent = "That site is already on the list.";
    return;
  }
  const nextId = store.settings.nextRuleId ?? 100;
  const newSite = { id: nextId, label: labelFromDomain(domain), domain, enabled: true, builtin: false };
  await setStore({
    sites: [...store.sites, newSite],
    settings: { ...store.settings, nextRuleId: nextId + 1 }
  });
  els.addInput.value = "";
  render();
});

els.restoreBtn.addEventListener("click", async () => {
  const store = await getStore();
  const existingDomains = new Set(store.sites.map((s) => s.domain));
  const missingDefaults = DEFAULT_SITES.filter((d) => !existingDomains.has(d.domain));
  await setStore({ sites: [...store.sites, ...missingDefaults] });
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") render();
});

render();
