# SOREVID Design Guideline

Use this guideline when designing another app in the SOREVID product system. Match the structure, typography, spacing, motion, density, and interaction feel. Do not copy the color palette from SOREVID VideoGET; each app should define its own colors.

## Design Personality

SOREVID apps should feel like focused desktop tools with a cinematic edge: polished, compact, confident, and operational. The interface should look premium without becoming decorative or slow to scan.

The design should prioritize:

- Fast recognition of the app brand at launch and in the header.
- Dense but calm work surfaces.
- Clear visual grouping without excessive card nesting.
- Soft glass-like surfaces, subtle depth, and restrained glow.
- Motion that feels intentional and smooth, never flashy.

Avoid:

- Marketing-page layouts.
- Oversized hero sections inside the app.
- Generic SaaS dashboards with plain system typography.
- Too many nested cards.
- Decorative gradients or glows that compete with controls.
- Explaining features with visible instructional text when the UI can be self-evident.

## UX Principles

SOREVID apps should feel direct, capable, and hard to get lost in. The user should always understand what they have, what the app is doing, and what action is available next.

Core workflow model:

- Put the main workflow on the first screen.
- Make the workflow sequence visible: input, preview/check, configure, run, monitor result.
- Keep the primary action persistent and easy to reach.
- Keep secondary actions close to the object they affect.
- Avoid hiding critical workflow steps inside menus or settings.

State clarity:

- Every async action needs an immediate state change.
- Long-running operations should show ongoing feedback, not just a spinner.
- Use plain status words such as `ready`, `checking`, `running`, `warning`, `failed`, and `completed`.
- When a job is queued or running, show enough context for the user to know what item is being processed.
- Preserve the user's selection and inputs after recoverable errors.

Error and warning behavior:

- Errors should explain what happened and what to do next.
- Avoid raw technical errors as the only visible message.
- Warnings should be visible near the affected item, not only in a global banner.
- If the app can recover, offer the recovery action near the warning.
- If the app cannot recover, keep the failed item visible so the user can retry or inspect it.

Configuration UX:

- Settings that affect output should show a concrete preview.
- Filename, folder, format, model, and mode settings should use short labels plus examples.
- Use segmented controls for small mode choices.
- Use select menus for longer option sets.
- Use toggles or checkboxes for binary choices.
- Do not make users remember how a setting changes output; show the result.

Batch and list UX:

- Lists should be scannable before they are editable.
- Show counts for selected, grouped, missing, completed, or failed items.
- Highlight items that need attention without making the whole screen feel broken.
- Group related items visually and let the user select/clear a group quickly.
- Editable list rows should keep stable height and alignment.
- Show only the most useful metadata by default; deeper details can live in a secondary panel or expandable area.

Action hierarchy:

- One primary action should dominate each workflow stage.
- Secondary actions should be visible but quieter.
- Destructive actions should be visually distinct and require deliberate intent.
- Buttons should use verbs: `Preview`, `Start`, `Retry`, `Validate`, `Export`, `Clear`.
- Avoid vague actions such as `Submit`, `OK`, or `Apply` when a more specific verb exists.

Empty and first-use states:

- Empty states should invite the first real action.
- Avoid large marketing copy in empty states.
- Provide a compact hint or example only when it reduces friction.
- If the app depends on local setup, show setup status as actionable cards or rows.

UX checklist:

- Can the user identify the primary action within two seconds?
- Can the user recover from a failed operation without losing their work?
- Does every loading state show what is being loaded or checked?
- Does every output-affecting setting show a preview or example?
- Are warnings attached to the item or control that caused them?
- Does the bottom action area summarize the current workflow state?
- Can batch users select all, clear, retry, and inspect without leaving the main screen?
- Does the app avoid long instructional copy inside the working surface?

## Typography

Use two font families:

- Primary UI font: `Outfit`
- Brand/display font: `Space Grotesk`

Recommended setup:

```css
@font-face {
  font-family: 'Outfit';
  src: url('./assets/fonts/Outfit/Outfit-VariableFont_wght.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Space Grotesk';
  src: url('./assets/fonts/Space_Grotesk/SpaceGrotesk-VariableFont_wght.ttf') format('truetype');
  font-weight: 300 700;
  font-style: normal;
  font-display: swap;
}

:root {
  font-family: Outfit, ui-sans-serif, system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Typography rules:

- Use `Outfit` for controls, body copy, panel labels, tables, forms, status text, and buttons.
- Use `Space Grotesk` for the main brand wordmark or major product title only.
- Keep `letter-spacing: 0` by default.
- Do not force mixed-case brand names into uppercase. Preserve exact product casing such as `VideoGET`.
- Use strong weights for utility labels: `700` to `800`.
- Use display/title weights sparingly: `800` to `900`.
- Compact desktop UI text should usually sit between `12px` and `14px`.
- Main brand title can be larger, but should not dominate the actual workspace.

## App Shell

The app should feel like a desktop command surface, not a web landing page.

Recommended shell structure:

- Full-height app container.
- Main workspace on the left.
- Optional activity/details pane on the right.
- Fixed bottom action bar for primary workflow actions.
- Background can be atmospheric, but content must remain readable.
- Hide scrollbars while preserving scroll behavior.

Scrollbar rule:

```css
* {
  box-sizing: border-box;
  scrollbar-width: none;
}

*::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

body {
  margin: 0;
  -ms-overflow-style: none;
}
```

## Brand Header

The header should identify the app quickly without acting like a hero banner.

Brand block pattern:

- App icon first.
- Product family name next, usually `SOREVID`.
- App-specific name after it, preserving exact case.
- Keep the brand row horizontally compact.
- Use the actual app icon directly, without wrapping it in an extra visible frame if the icon already has its own shape/background.

Recommended proportions:

- Header icon: `44px` to `56px`.
- Product family word: heavier and slightly larger.
- App-specific word: smaller or lighter, but still clearly part of the name.
- Gap between icon and wordmark: `12px` to `16px`.
- Gap between product family and app name: `8px` to `12px`.

Brand CSS pattern:

```css
.brand-title-primary {
  font-family: 'Space Grotesk', Outfit, ui-sans-serif, system-ui, sans-serif;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 0.96;
}

.brand-title-secondary {
  font-family: Outfit, ui-sans-serif, system-ui, sans-serif;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
}
```

Do not add `text-transform: uppercase` to product names unless the actual brand text is uppercase.

## Loading Screen

Every SOREVID app should have a short branded loading screen.

Loading behavior:

- Minimum visible time: `2000ms`.
- Center the app icon and wordmark.
- Use a soft aura or gentle glow behind the logo.
- Use a subtle progress line or shimmer below the wordmark.
- Fade out smoothly into the app.
- Avoid full-screen horizontal sweep effects, harsh moving bands, or hard vertical edges.

Recommended motion:

```css
.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 22px;
  overflow: hidden;
  animation: loadingExit 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.loading-logo-shell {
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
  animation: loadingLogoIn 850ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
```

Use app-specific colors for glow/progress, but keep the movement language the same.

## Layout And Spacing

Spacing should be compact but breathable.

Recommended values:

- App workspace padding: `24px` to `32px`.
- Major section gap: `16px` to `20px`.
- Panel padding: `16px` to `18px`.
- Repeated item gap: `8px` to `12px`.
- Button height: `40px` to `44px`.
- Input height: `38px` to `42px`.
- Panel radius: `8px` to `12px`, but prefer `8px` for dense repeated cards.

Rules:

- If panels are visually separate, give them enough vertical gap.
- If panels are close together, make them feel like one grouped block with internal dividers.
- Do not create a stack of cards inside cards.
- Use grids for controls that need alignment.
- Use fixed/stable dimensions for icons, buttons, thumbnails, and segmented controls.

## Components

Buttons:

- Use icon + text for important actions.
- Use Lucide icons when available.
- Keep button labels short and command-like.
- Use one strong primary action per workflow area.
- Secondary buttons should be quieter but still tactile.

Tabs:

- Use compact segmented tabs for top-level app sections.
- Active tab should have clear surface/depth difference.
- Avoid page reload behavior; tabs should feel instant.

Forms:

- Labels should be short and direct.
- Inputs should have compact height and clear focus rings.
- Prefer segmented controls for small option sets.
- Prefer select menus for longer option sets.
- Show concrete examples for settings that affect filenames, output, or formatting.

Status Cards:

- Status cards should be scannable in one glance.
- Use icon, title, and compact value.
- Do not over-explain status meaning unless needed.

Bottom Action Bar:

- Keep the primary workflow action fixed and easy to reach.
- Left side should summarize current state.
- Right side should contain controls and the primary action.
- Avoid putting too many unrelated controls in the bottom bar.

## Motion

Motion should support perceived quality and state changes.

Recommended easing:

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

Use motion for:

- Loading logo entrance.
- Tab panel fade/slide.
- Button hover lift.
- Progress shimmer.
- Subtle glow pulse on primary action.

Avoid:

- Large lateral sweeps across the whole app.
- Repeating movement that distracts during work.
- Animations that change layout dimensions.
- Long animations after the app is usable.

## Surfaces And Depth

Do not copy colors between SOREVID apps. Instead, copy the depth model.

Each app should define its own tokens:

```css
:root {
  --app-bg: ...;
  --surface: ...;
  --surface-2: ...;
  --surface-3: ...;
  --border: ...;
  --border-soft: ...;
  --text-strong: ...;
  --text: ...;
  --text-muted: ...;
  --accent: ...;
  --accent-bright: ...;
  --accent-glow: ...;
  --accent-ring: ...;
}
```

Depth rules:

- Main panels should use translucent or layered surfaces.
- Borders should be present but quiet.
- Use glow only for brand, loading, primary action, or focus.
- Avoid heavy drop shadows on every component.
- Keep foreground controls clearly separated from background media.

## Responsive Behavior

Desktop-first, but mobile/tablet should still be clean.

Rules:

- Collapse side panes under the main workspace on narrow screens.
- Let grids become single-column below tablet widths.
- Keep topbar actions stacked when horizontal space is tight.
- Do not scale typography directly with viewport width except carefully constrained brand text.
- Preserve button readability before preserving one-line layout.

## Copywriting

UI copy should be short and functional.

Use:

- `Start download`
- `Preview`
- `Settings`
- `Check tools`
- `Episode file names`
- `Example: 001.mp4`

Avoid:

- Long explanatory paragraphs inside work areas.
- Marketing phrases.
- Repeating the app name in every panel.
- Technical labels when a user-facing phrase is clearer.

## Implementation Checklist

Before handing off a SOREVID-style UI, verify:

- The app uses `Outfit` for UI and `Space Grotesk` for brand/display.
- Brand casing is exact.
- Loading screen stays visible for at least `2s`.
- Loading motion has no harsh horizontal sweep or vertical edge artifact.
- Scrollbars are hidden but scrolling still works.
- Header icon uses the actual app icon directly.
- Buttons, tabs, inputs, and panels have stable dimensions.
- The primary action is visually obvious.
- Panel spacing is either clearly separated or intentionally grouped.
- The app uses its own color tokens instead of copying another SOREVID app palette.
