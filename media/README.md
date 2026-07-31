# Demo video

`veilvote-demo.mp4` is assembled, not screen-recorded, so it stays reproducible and
narrator-free of any personal voice:

1. **Screens** — the running app (offline demo mode) is driven with Playwright and
   screenshotted at each stage (landing, mid-vote, completed flow with tally + activity
   log). The terminal and README scenes are static HTML mockups styled to match, rendered
   the same way.
2. **Narration** — macOS `say -v Samantha`, with embedded `[[slnc N]]` / `[[rate N]]`
   commands in the script text for pauses and pacing (Samantha is the only bundled macOS
   voice that honors those legacy embedded speech commands).
3. **Motion** — each still gets a subtle Ken Burns zoom (`ffmpeg zoompan`) sized to its
   narration length, with a short fade in/out at the cut.
4. **Assembly** — per-scene silent video + padded audio are muxed, then concatenated and
   re-encoded (h264/aac) with `ffmpeg`.

No proprietary assets or third-party voices are used, so the whole thing can be
regenerated from a fresh `npm run compact && npm test` run plus new screenshots any time
the UI changes.
