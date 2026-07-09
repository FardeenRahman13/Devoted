// Devoted — background service worker
// Single source of truth for blocking logic. The popup only edits storage;
// this worker reacts to storage changes and (re)builds declarativeNetRequest rules.

const DEFAULT_SITES = [
  { id: 1, label: "Facebook", domain: "facebook.com", enabled: true, builtin: true },
  { id: 2, label: "YouTube", domain: "youtube.com", enabled: true, builtin: true },
  { id: 3, label: "Twitter / X", domain: "twitter.com", enabled: true, builtin: true },
  { id: 4, label: "Twitter / X", domain: "x.com", enabled: true, builtin: true },
  { id: 5, label: "Instagram", domain: "instagram.com", enabled: true, builtin: true }
];

const DEFAULT_SETTINGS = {
  masterEnabled: true,
  focusEndsAt: null,     // epoch ms while a locked focus session is running
  nextRuleId: 100,       // counter for new custom-site rule ids
  theme: "dark"          // "dark" | "light" — shared across popup and blocked page
};

async function getStore() {
  const data = await chrome.storage.sync.get(["sites", "settings", "unlockedUntil"]);
  return {
    sites: data.sites ?? DEFAULT_SITES,
    settings: data.settings ?? DEFAULT_SETTINGS,
    unlockedUntil: data.unlockedUntil ?? {} // { domain: epochMs } temporary friction-unlocks from blocked.html
  };
}

async function seedDefaults() {
  const data = await chrome.storage.sync.get(["sites", "settings"]);
  const updates = {};
  if (!data.sites) updates.sites = DEFAULT_SITES;
  if (!data.settings) updates.settings = DEFAULT_SETTINGS;
  if (Object.keys(updates).length) await chrome.storage.sync.set(updates);
}

function domainToFilter(domain) {
  // declarativeNetRequest adblock-style syntax: ||domain^ matches domain + all subdomains/paths
  return `||${domain}^`;
}

async function rebuildRules() {
  const { sites, settings, unlockedUntil } = await getStore();
  const now = Date.now();

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const addRules = [];
  if (settings.masterEnabled) {
    for (const site of sites) {
      if (!site.enabled) continue;
      const unlockExpiry = unlockedUntil[site.domain];
      if (unlockExpiry && unlockExpiry > now) continue; // temporarily unlocked, skip blocking
      addRules.push({
        id: site.id,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            extensionPath: `/blocked.html?site=${encodeURIComponent(site.domain)}&label=${encodeURIComponent(site.label)}`
          }
        },
        condition: {
          urlFilter: domainToFilter(site.domain),
          resourceTypes: ["main_frame"]
        }
      });
    }
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });

  // Clean up any expired temporary unlocks so storage doesn't grow forever
  const cleaned = {};
  let changed = false;
  for (const [domain, expiry] of Object.entries(unlockedUntil)) {
    if (expiry > now) cleaned[domain] = expiry;
    else changed = true;
  }
  if (changed) await chrome.storage.sync.set({ unlockedUntil: cleaned });
}

// --- Alarms: rebuild rules when a temporary unlock expires or a focus session ends ---

async function scheduleWakeups() {
  const { settings, unlockedUntil } = await getStore();
  await chrome.alarms.clear("focus-session-end");
  await chrome.alarms.clear("unlock-expiry");

  if (settings.focusEndsAt) {
    chrome.alarms.create("focus-session-end", { when: settings.focusEndsAt });
  }
  const expiries = Object.values(unlockedUntil);
  if (expiries.length) {
    chrome.alarms.create("unlock-expiry", { when: Math.min(...expiries) });
  }
}

chrome.alarms.onAlarm.addListener(async () => {
  await rebuildRules();
  await scheduleWakeups();
});

chrome.runtime.onInstalled.addListener(async () => {
  await seedDefaults();
  await rebuildRules();
  await scheduleWakeups();
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildRules();
  await scheduleWakeups();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  if (changes.sites || changes.settings || changes.unlockedUntil) {
    await rebuildRules();
    await scheduleWakeups();
  }
});
