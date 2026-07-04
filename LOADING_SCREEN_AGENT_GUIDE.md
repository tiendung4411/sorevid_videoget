# Loading Screen Design Guide For AI Agents

Use this guide to recreate the same loading-screen pattern in another app. Do not copy the original app name or color palette. Treat brand name, logo, and colors as replaceable tokens.

## Design Intent

Create a polished startup overlay that appears above the full app for about 2 seconds, then fades away automatically. The design should feel premium and calm:

- Fullscreen fixed overlay.
- Centered logo mark.
- Compact two-part wordmark below the logo.
- Thin animated progress shimmer below the wordmark.
- Soft radial aura behind the logo.
- Smooth entrance for logo/text and delayed fade-out for the full overlay.

## Required App State

In React, keep the loading screen mounted briefly after app launch:

```tsx
const [bootLoading, setBootLoading] = useState(true)

useEffect(() => {
  const timer = window.setTimeout(() => setBootLoading(false), 2000)
  return () => window.clearTimeout(timer)
}, [])
```

Render the overlay near the top of the app shell, before the main app content:

```tsx
<main className="app-shell">
  {bootLoading && (
    <div className="app-loading-screen" role="status" aria-live="polite">
      <div className="loading-logo-shell">
        <img className="loading-logo" src={appLogo} alt="APP_NAME" />
      </div>
      <div className="loading-wordmark">
        <span>BRAND_PART_ONE</span>
        <strong>BRAND_PART_TWO</strong>
      </div>
      <div className="loading-progress" aria-hidden="true" />
    </div>
  )}

  {/* Main app content */}
</main>
```

Replace `appLogo`, `APP_NAME`, `BRAND_PART_ONE`, and `BRAND_PART_TWO` with the target app's actual brand assets.

## CSS Tokens To Replace

Define app-specific values before copying the CSS:

```css
:root {
  --loading-bg-base: #101010;
  --loading-bg-a: rgba(16, 16, 16, 0.98);
  --loading-bg-b: rgba(32, 32, 32, 0.94);
  --loading-text-strong: #f5f5f5;
  --loading-text-muted: #d9d9d9;
  --loading-accent: #ff8a3d;
  --loading-accent-soft: rgba(255, 138, 61, 0.12);
  --loading-accent-faint: rgba(255, 138, 61, 0.04);
  --loading-progress-bg: rgba(255, 255, 255, 0.1);
  --loading-shadow: rgba(0, 0, 0, 0.34);
}
```

Use the target app's own colors. Keep contrast high and avoid making the loading screen one flat color.

## CSS Implementation

```css
.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 22px;
  color: var(--loading-text-strong);
  background:
    linear-gradient(145deg, var(--loading-bg-a), var(--loading-bg-b)),
    var(--loading-bg-base);
  overflow: hidden;
  animation: loadingExit 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.app-loading-screen::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 520px;
  height: 520px;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    var(--loading-accent-soft) 0%,
    var(--loading-accent-faint) 38%,
    transparent 72%
  );
  transform: translate(-50%, -50%);
  filter: blur(18px);
  animation: loadingAura 2s ease-out forwards;
  pointer-events: none;
}

.loading-logo-shell {
  position: relative;
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
  animation: loadingLogoIn 850ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.loading-logo {
  position: relative;
  z-index: 1;
  width: 112px;
  height: 112px;
  object-fit: contain;
  filter:
    drop-shadow(0 16px 32px var(--loading-shadow))
    drop-shadow(0 0 28px var(--loading-accent-soft));
}

.loading-wordmark {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  animation: loadingTextIn 900ms 150ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.loading-wordmark span {
  color: var(--loading-accent);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
  text-shadow: 0 0 24px var(--loading-accent-soft);
}

.loading-wordmark strong {
  color: var(--loading-text-muted);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0;
}

.loading-progress {
  position: relative;
  z-index: 1;
  width: min(220px, 44vw);
  height: 3px;
  border-radius: 999px;
  background: var(--loading-progress-bg);
  overflow: hidden;
}

.loading-progress::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    transparent,
    var(--loading-accent) 36%,
    var(--loading-text-muted) 62%,
    transparent
  );
  transform: translateX(-100%);
  animation: loadingProgress 1.6s 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes loadingLogoIn {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes loadingTextIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes loadingExit {
  0%,
  76% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
}

@keyframes loadingProgress {
  0% {
    transform: translateX(-100%);
  }
  72%,
  100% {
    transform: translateX(100%);
  }
}

@keyframes loadingAura {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92);
  }
  30%,
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0.82;
    transform: translate(-50%, -50%) scale(1.03);
  }
}
```

## Implementation Notes

- Keep `z-index` above the app chrome and any background video/canvas.
- Use `role="status"` and `aria-live="polite"` on the overlay.
- Use `aria-hidden="true"` on the progress shimmer because it is decorative.
- Keep the logo square, ideally 96-128px on desktop. The current pattern uses 112px.
- Keep the wordmark compact. Do not turn this into a marketing hero.
- The loading duration is controlled in both React and CSS. If changing the timeout from `2000`, update `loadingExit` and related animation durations so the fade still completes naturally.
- For a single-word brand, use only one text element or hide the secondary wordmark part. Do not force awkward brand splitting.

## Agent Checklist

1. Import the target app logo.
2. Add the `bootLoading` state and 2-second timer.
3. Render the overlay before the main app content.
4. Copy the CSS and replace all color tokens.
5. Replace all brand text and alt text.
6. Test desktop and mobile widths.
7. Confirm the overlay fades out and does not block clicks after exit.
