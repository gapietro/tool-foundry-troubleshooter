---
name: servicenow-html-brand
description: Use when creating HTML presentations, slide decks, dashboards, or any browser-rendered branded content for ServiceNow. Downstream skill inheriting from servicenow-brand-standards-reference.
---

# ServiceNow HTML/Artifact Brand Skill

## Relationship to Brand Standards

This skill inherits from `servicenow-brand-standards-reference`. All hard rules (voice & tone, brand positioning, accessibility, core color identity) apply without exception.

### Format-specific overrides:
- **Background treatments**: Uses Infinite Blue as primary dark background. Gradient slides use `linear-gradient(135deg, #032D42, #052D42, #063D52)` for subtle depth.
- **Supplementary color usage**: Bright Blue (`#52B8FF`) and Bright Indigo (`#7661FF`) may be used for chart accents and interactive states.
- **Layout**: Full-viewport slides (`100vw x 100vh`) with `6vh 8vw` padding.

## Font Loading

ServiceNow Sans web fonts via `@font-face`:

```css
@font-face {
  font-family: 'ServiceNow Sans';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-Light.woff2') format('woff2');
  font-weight: 300; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-Regular.woff2') format('woff2');
  font-weight: 400; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-Medium.woff2') format('woff2');
  font-weight: 500; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-Bold.woff2') format('woff2');
  font-weight: 700; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans Display';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-DisplayMedium.woff2') format('woff2');
  font-weight: 500; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans Display';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSans-DisplayBold.woff2') format('woff2');
  font-weight: 700; font-style: normal;
}
@font-face {
  font-family: 'ServiceNow Sans Mono';
  src: url('https://www.servicenow.com/community/fonts2/ServiceNowSansMono-Regular.woff2') format('woff2');
  font-weight: 400; font-style: normal;
}
```

Fallback stack: `'ServiceNow Sans', Arial, sans-serif`

## CSS Variables

```css
:root {
  /* Primary */
  --sn-infinite-blue: #032D42;
  --sn-wasabi: #63DF4E;
  --sn-white: #FFFFFF;
  --sn-black: #000000;

  /* Neutral grays */
  --sn-gray-50: #F9FAFB;
  --sn-gray-100: #F3F4F6;
  --sn-gray-200: #E5E7EB;
  --sn-gray-400: #9CA3AF;
  --sn-gray-500: #6B7280;
  --sn-gray-700: #374151;

  /* Supplementary (limited use) */
  --sn-bright-blue: #52B8FF;
  --sn-bright-indigo: #7661FF;
  --sn-bright-purple: #BF71F2;

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;
}
```

## Slide Themes

Two primary themes:

| Theme | Background | Headlines | Eyebrows | Body text |
|-------|-----------|-----------|----------|-----------|
| Dark (`.slide--dark`) | Infinite Blue `#032D42` | Two-tone: Wasabi + White | Wasabi Green | White |
| Light (`.slide--light`) | White/Off-white `#F9FAFB` | Infinite Blue | Infinite Blue | Infinite Blue or Black |

**Critical rules:**
- Dark backgrounds: White text everywhere. Wasabi Green ONLY for eyebrows and headline accent.
- Light backgrounds: Infinite Blue or Black for ALL text. **Never** Wasabi Green on light.
- Cards on dark backgrounds: `rgba(255,255,255,0.06)` fill, White text.
- Cards on light backgrounds: White fill, `box-shadow`, Infinite Blue text.

## Two-Tone Headline Treatment

On dark backgrounds, headlines use Wasabi Green for the first portion, White for the rest:

```html
<h1 class="slide__title">
  <span class="wasabi">Put AI to work</span><br>for people
</h1>
```

```css
.slide--dark .slide__title { color: var(--sn-white); }
.wasabi { color: var(--sn-wasabi); }
```

Rules: Only on dark backgrounds. Minimum 3 words. Never on body copy.

## Type Scale (Viewport-Relative)

```css
.slide__eyebrow { font-family: 'ServiceNow Sans Mono'; font-size: 1.2vw; font-weight: 400; text-transform: uppercase; letter-spacing: 0.1em; }
.slide__title { font-family: 'ServiceNow Sans Display'; font-size: 4.5vw; font-weight: 700; line-height: 0.95; }
.slide__subtitle { font-family: 'ServiceNow Sans Display'; font-size: 2vw; font-weight: 500; line-height: 1.3; }
.slide__body { font-family: 'ServiceNow Sans'; font-size: 1.5vw; font-weight: 300; line-height: 1.5; }
.card__title { font-family: 'ServiceNow Sans'; font-size: 1.4vw; font-weight: 700; }
.card__text { font-family: 'ServiceNow Sans'; font-size: 1.15vw; font-weight: 300; line-height: 1.5; }
```

## Rounded Corners (Non-Negotiable)

- Cards/containers: `16px`
- Small elements (badges, chips): `8px`
- Buttons/CTAs: `9999px` (pill)
- Never use `0px` radius on any element

## Quick Reference

| Element | Dark bg | Light bg |
|---------|---------|----------|
| Eyebrow text | Wasabi `#63DF4E` | Infinite Blue `#032D42` |
| Headline | Wasabi + White two-tone | Infinite Blue |
| Body text | White `#FFFFFF` | Infinite Blue or Black |
| Card bg | `rgba(255,255,255,0.06)` | White with shadow |
| Card text | White | Infinite Blue |
| Accent highlights | Wasabi (sparingly) | Bold text (never color) |
| Borders | `rgba(255,255,255,0.1)` | `#E5E7EB` |
