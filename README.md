# DIY Photobooth — V5

A free, client-side photobooth with a template-driven camera and upload system.

## V5: Per-slot photo sources

Each template slot can independently use:
- Camera — captures the live frame using that slot's exact aspect ratio.
- Upload — selects a local image and fits/crops it into the slot without stretching.

You can mix sources in the same strip, for example:
- Photo 1 → Camera
- Photo 2 → Upload
- Photo 3 → Camera

The existing Upload All button remains available as a quick all-upload workflow.

## Privacy
Everything runs locally in the browser. No backend, account, server upload, or paid API is required.
