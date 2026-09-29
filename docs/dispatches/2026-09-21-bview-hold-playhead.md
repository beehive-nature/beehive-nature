# bViEw hold playhead (2026-09-21)

Early progressive Blob carries full moov duration but short mdat — Chrome races `currentTime` to the end ("skips to the end").

Fix: track `keepAt`, clamp while the download bar is up, refresh the Blob every 2 MiB restoring playhead, prefer `keepAt` on final swap.
