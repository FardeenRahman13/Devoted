# Devoted — Distraction Blocker

A small Chrome/Edge/Brave extension that blocks Facebook, YouTube, Twitter/X,
Instagram, and any custom site you add, so you can focus.

## Install (unpacked, ~30 seconds)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   the browser loads the extension straight from these files).
2. Open `chrome://extensions` (also works for `edge://extensions` or
   `brave://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `devoted` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin) so it's one
   click away.

## How it works

- Click the icon to open the popup.
- The big switch at the top turns blocking on/off.
- Facebook, YouTube, Twitter/X, and Instagram are blocked by default — flip
  any of them off individually, or remove them entirely.
- Add any other site with the box at the bottom (just type the domain, e.g.
  `reddit.com`).
- **Focus session** (25 / 50 / 90 min): starts a *locked* session — the
  master switch and the toggles for currently-blocked sites are disabled
  until the timer runs out, so you can't casually turn blocking off mid-task.
- **Dark / light mode**: toggle with the icon in the top-right of the popup.
  The choice is stored with the rest of your settings, so the blocked page
  matches automatically — no separate switch to manage.
- If you land on a blocked site, you'll see a calm blocked page. It has a
  small "I need through, just this once" option that requires typing out a
  short phrase to unlock that one site for 5 minutes — enough friction to
  stop a reflexive click, but it's disabled entirely during a locked focus
  session.

## Notes

- Blocking works by matching the domain (and all its subdomains/paths), so
  `youtube.com` blocks `www.youtube.com`, `m.youtube.com`, etc.
- Everything is stored locally via `chrome.storage.sync`, so your list syncs
  across your signed-in browsers and nothing is sent anywhere else.
- No external requests, no fonts or scripts loaded from the internet —
  works fully offline.
