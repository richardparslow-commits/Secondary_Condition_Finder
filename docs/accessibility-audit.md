# Accessibility Audit & Compliance Report (WCAG 2.1 AA)

## Overview
This document outlines the accessibility standards, automated validation rules, keyboard navigation protocols, and manual screen reader pass criteria for the **Secondary Condition Finder for VA Claims** application.

---

## 1. Compliance Standard: WCAG 2.1 Level AA
The application targets WCAG 2.1 Level AA compliance, ensuring usability for veterans relying on screen readers (NVDA, VoiceOver), keyboard-only navigation, and high-contrast display modes.

---

## 2. Key Accessibility Requirements & Implementation
- **Semantic HTML & Landmarks:** Every view utilizes proper landmark elements (`<main>`, `<nav>`, `<header>`, `<footer>`) and hierarchical headings (`<h1>` through `<h4>`).
- **Form Labelling & ARIA:** All form controls, checkboxes, and inputs are explicitly associated with descriptive labels via `<label for="...">` or `aria-labelledby`.
- **Keyboard Traversal:** Interactive elements (buttons, links, inputs, accordions) are fully focusable in logical tab order with visible focus indicators.
- **Color Contrast:** Text elements maintain a minimum contrast ratio of 4.5:1 against their background (Tailwind `gray-900` on white/light backgrounds).

---

## 3. Automated Test Verification
Automated tests in `tests/accessibility-ux-reliability.test.ts` validate:
1. Presence of primary heading structures (`<h1>`) on core routes.
2. Form input labelling and explicit accessible names.
3. ARIA roles and landmark presence.

---

## 4. Manual Screen Reader & Keyboard Navigation Protocol
| Test Case | Tool / Method | Expected Result | Status |
|---|---|---|---|
| **Tab Traversal** | Physical Keyboard (Tab / Shift+Tab) | Focus moves logically through interactive intake elements without traps. | Verified |
| **Screen Reader Announcement** | NVDA (Windows) / VoiceOver (macOS) | Form inputs announce labels, error states, and result counts correctly. | Verified |
| **High Contrast Mode** | OS High Contrast / Dark Mode | All text and badges remain legible and meet contrast thresholds. | Verified |
