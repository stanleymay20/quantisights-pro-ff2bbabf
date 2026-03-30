

# Forensic UI/UX Audit & Remediation Plan

## Executive Summary

The app has strong architecture but suffers from **vertical compression on mobile** — too many stacked layers before the user reaches actionable content. The dashboard alone renders: GlobalContextBar (28px) → IntelligenceStatusBar (36px) → Header (56px) → DemoBanner (~60px) → Greeting → HeroInsight (~200px+ of dense card) → DecisionMemoryWidget → SystemHealthDashboard — all before the actual command center. On a 390px viewport with browser chrome, users see almost no actionable content above the fold.

---

## Phase 1 — Critical Mobile Fixes (P0)

### 1.1 Hide GlobalContextBar on mobile
The org → workspace → project → dataset breadcrumb strip adds 28px of clipped, near-useless chrome on mobile. Hide it below `md` breakpoint — that context is already in the sidebar and header OrgSwitcher.

**File:** `src/components/layout/GlobalContextBar.tsx`
- Add `hidden md:flex` to the container div

### 1.2 Collapse IntelligenceStatusBar on mobile
The scrolling status strip (system status, risk, signals, advisories, freshness) clips on 390px. On mobile, show only the most critical indicator (system status dot + risk level), hide the rest.

**File:** `src/components/dashboard/IntelligenceStatusBar.tsx`
- Wrap non-essential segments in `hidden sm:flex`
- Reduce height to `h-7` on mobile

### 1.3 Compact Dashboard header on mobile
The header has OrgSwitcher, ProjectSwitcher, refresh, notifications, user menu all on one 56px bar. On mobile, OrgSwitcher and ProjectSwitcher text overflows.

**File:** `src/pages/Dashboard.tsx`
- Reduce header height to `h-12` on mobile
- Hide ProjectSwitcher label on mobile (icon-only)
- Tighten padding

### 1.4 Make HeroInsight card mobile-readable
Currently renders: signal label, confidence badge, message, recommended action, estimated impact, consequence of inaction, owner/timeframe/readiness, reasoning, category/evidence chain, and "Resolve" button — ALL in one dense card. On 390px this is ~250px+ of compressed text.

**File:** `src/components/dashboard/HeroInsight.tsx`
- Hide the reasoning line (`Based on:...`) on mobile
- Hide the evidence chain footer on mobile
- Move "Resolve" button from far-right column to a full-width bottom action
- Reduce padding from `p-5` to `p-3 sm:p-5`
- Reduce icon size on mobile

### 1.5 CookieConsent banner — add bottom safe area
The cookie banner is `fixed bottom-0` with `z-[100]` and overlaps mobile browser navigation chrome + any bottom content.

**File:** `src/components/CookieConsent.tsx`
- Add `pb-safe` / `safe-area-bottom` padding
- Reduce padding on mobile from `p-4` to `p-3`
- Make the card more compact on mobile

---

## Phase 2 — Dashboard Density Reduction (P1)

### 2.1 Collapse SystemHealthDashboard on mobile
The full system health dashboard with progress bars and multiple cards is too dense for mobile first-view. Show a single-line summary with expandable detail.

**File:** `src/components/dashboard/SystemHealthDashboard.tsx`
- On mobile: show a single compact status line (e.g., "System: Healthy · Loop: 50%")
- Make the full card expandable/collapsible

### 2.2 Collapse DecisionMemoryWidget on mobile
Similar issue — full lifecycle timeline with learning narratives is too dense.

**File:** `src/components/dashboard/DecisionMemoryWidget.tsx`
- On mobile: show summary count only (e.g., "3 decisions tracked · 1 recalibrated")
- Expandable for detail

### 2.3 Simplify BoardroomBrief on mobile
4 text paragraphs + footer with counts + link. On mobile, reduce to 2 lines + action.

**File:** `src/components/dashboard/BoardroomBrief.tsx`
- On mobile: hide the risk line and calibration line
- Reduce padding from `p-5` to `p-3 sm:p-5`

### 2.4 ProtectionStatus — compact mobile grid
The 4-column driver grid becomes 2x2 but is still dense.

**File:** `src/components/dashboard/ProtectionStatus.tsx`
- On mobile: show as a horizontal scrollable strip instead of grid
- Reduce padding

---

## Phase 3 — Global Design System Fixes (P2)

### 3.1 Consistent card padding
Cards across the app use inconsistent padding: `p-4`, `p-5`, `p-6`. Standardize to `p-3 sm:p-4 md:p-5` for data-dense cards.

### 3.2 Typography hierarchy
The `text-[10px]` and `text-[11px]` sizes are used extensively for metadata. On mobile these are barely readable. Set a floor of `text-[11px]` for all visible text, use `text-xs` (12px) as the minimum for actionable content.

### 3.3 Badge/pill overflow
Confidence badges, status badges, and escalation pills can wrap awkwardly on mobile. Add `whitespace-nowrap` and ensure flex containers use `flex-wrap` with proper gaps.

---

## Phase 4 — Page-by-Page Fixes

### Landing page
- Already mobile-optimized with responsive breakpoints
- Minor: CTA buttons stack correctly, capability pills wrap well
- No critical fixes needed

### Login/Register
- Standard auth forms, already mobile-safe
- No fixes needed

### Settings/Admin pages
- These use standard form layouts — verify they don't overflow on mobile
- Low priority

### Advisory/Decisions pages
- Decision queue cards have similar density issues to HeroInsight
- Apply same pattern: reduce metadata on mobile, move actions to bottom

---

## Implementation Order

1. GlobalContextBar hide on mobile (1 line change)
2. IntelligenceStatusBar mobile collapse (3-4 line changes)
3. Dashboard header compaction (5-6 line changes)
4. HeroInsight mobile readability (15-20 line changes)
5. CookieConsent safe-area fix (3-4 line changes)
6. SystemHealthDashboard mobile collapse (10-15 lines)
7. DecisionMemoryWidget mobile collapse (10-15 lines)
8. BoardroomBrief mobile simplification (5-6 lines)
9. ProtectionStatus mobile compaction (5-6 lines)

**Total: ~9 files, ~70-80 lines of changes. All safe, non-breaking, CSS/conditional-render only.**

---

## Expected Outcome

Before: On 390px, the user sees ~120px of chrome (context bar + status bar + header) before any content, then must scroll through 500px+ of dense cards before reaching actionable surfaces.

After: On 390px, the user sees ~48px of chrome (compact header only), then a clean greeting, a readable signal card with visible "Resolve" action, and compact summary widgets — all above the fold.

