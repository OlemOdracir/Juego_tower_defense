# UI Layout Audit (Panel + Map Framing)

## Scope
This audit targets two user-visible defects:
- bottom panel not consistently visible on Windows taskbar / scaling setups
- visible empty band on the right side of the map view

The analysis covers:
- DOM layout metrics (`panel`, `viewport`, `canvas`)
- viewport sizing (`innerWidth`, `innerHeight`, `devicePixelRatio`)
- projected map playable bounds from runtime camera

Resolution matrix:
- `1366x768`
- `1600x900`
- `1920x1080`
- `2560x1440`

## Baseline (before refactor)

Artifacts:
- `audit-before-1366x768.png`
- `audit-before-1600x900.png`
- `audit-before-1920x1080.png`
- `audit-before-2560x1440.png`

| Resolution | inner (reported) | DPR | panelBottom | viewportBottom | canvasLeft / canvasRight |
|---|---:|---:|---:|---:|---:|
| 1366x768 | 1821x1024 | 0.75 | 990.00 | 794.00 | -6.00 / 1827.33 |
| 1600x900 | 2133x1200 | 0.75 | 1166.00 | 970.00 | -6.00 / 2139.33 |
| 1920x1080 | 2560x1440 | 0.75 | 1406.00 | 1210.00 | -6.00 / 2566.00 |
| 2560x1440 | 3413x1920 | 0.75 | 1886.00 | 1690.00 | -6.00 / 3419.33 |

Notes:
- Baseline lacked projected playable-bounds telemetry.
- DOM shows panel anchored inside viewport flow, but map framing still looked overly padded and visually off-center.

## Refactor decisions and root cause

### Root cause by subsystem
- CSS layout: critical panel/canvas offsets were controlled by local hardcoded values.
- Camera framing: framing was controlled partly in camera config and partly in runtime math, without a single runtime contract.
- OS scaling: effective viewport (`innerWidth`, `innerHeight`) differs from nominal browser size under Windows scaling; layout was not centrally normalized.

### Changes implemented
- Added central `LAYOUT_CONFIG` in `src/config/layout.js`.
- Added central `FRAMING_CONFIG` in `src/config/framing.js`.
- Kept compatibility export `CAMERA_CONFIG` in `src/config/camera.js` as alias of `FRAMING_CONFIG`.
- Added runtime `layout-coordinator` (`src/game/runtime/layout/layout-coordinator.js`) to apply CSS vars from config on init + resize.
- Refactored `createSceneRuntime(...)` to consume framing object explicitly, not hidden constants.
- Added runtime map projection telemetry (`getProjectedPlayableBounds`) and exposed metrics via `window.__layoutAudit`.
- Replaced unconstrained absolute zoom behavior with ratio-based zoom limits over fit (`zoom.minRatio/maxRatio`) to prevent unusable map shrink/overshoot.

## Results (after refactor)

Artifacts:
- `audit-after-1366x768.png`
- `audit-after-1600x900.png`
- `audit-after-1920x1080.png`
- `audit-after-2560x1440.png`

| Resolution | inner (reported) | DPR | panelBottom | viewportBottom | projected map bbox (w x h) |
|---|---:|---:|---:|---:|---:|
| 1366x768 | 1821x1024 | 0.75 | 990.00 | 794.00 | 1360.31 x 795.27 |
| 1600x900 | 2133x1200 | 0.75 | 1166.00 | 970.00 | 1661.84 x 971.55 |
| 1920x1080 | 2560x1440 | 0.75 | 1406.00 | 1210.00 | 2073.02 x 1211.94 |
| 2560x1440 | 3413x1920 | 0.75 | 1886.00 | 1690.00 | 2895.38 x 1692.71 |

Projected playable-bounds corners are now available from runtime metrics (`window.__layoutAudit.getMetrics().projectedPlayableBounds`), enabling deterministic framing verification.

## Accepted ownership model
- Panel/canvas positioning knobs: **owner = `LAYOUT_CONFIG`** only.
- Camera/framing knobs: **owner = `FRAMING_CONFIG`** only.
- Runtime applies config and exposes telemetry; CSS uses `--cfg-*` variables only for critical layout values.

## Remaining risks
- Browser/OS DPI differences can still shift perceived framing, but now are tunable from config only.
- Existing non-critical style numbers (visual cosmetics) remain in CSS by design and do not control panel/map visibility contracts.
