# Task stub: Make manual label movement visible and functional

The existing label-editor UI does not surface manual dragging/rotation controls clearly in the live figure. Use this stub to implement a fix without merging conflicts.

:::task-stub{title="Surface and verify manual label editing"}
- Open `nkant.html` and ensure the label-editing affordance is clearly visible near the canvas by default (e.g., toggle button or mode indicator).
- Verify the JS hook in `nkant.js` that enables dragging/rotating labels is initialized after the SVG renders; ensure listeners attach when entering edit mode.
- Add a concise tooltip or inline hint in the label editor panel to instruct users they can drag labels directly on the figure and rotate them via the control.
- Confirm stored offsets/rotations persist across redraws by triggering a recomputation (e.g., resizing or rerender) and checking that labels keep their manual positions.
- Add a minimal smoke test/manual checklist to `docs` describing how to activate edit mode and drag a label to confirm the feature is present.
:::
