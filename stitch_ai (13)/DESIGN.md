---
name: Nexus Course Architect
colors:
  surface: '#faf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#faf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e8'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#404753'
  inverse-surface: '#2f3031'
  inverse-on-surface: '#f2f0f0'
  outline: '#707785'
  outline-variant: '#c0c7d6'
  surface-tint: '#005fae'
  primary: '#005daa'
  on-primary: '#ffffff'
  primary-container: '#0075d5'
  on-primary-container: '#fefcff'
  inverse-primary: '#a5c8ff'
  secondary: '#266d00'
  on-secondary: '#ffffff'
  secondary-container: '#85fa51'
  on-secondary-container: '#287100'
  tertiary: '#7d5400'
  on-tertiary: '#ffffff'
  tertiary-container: '#9d6a00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a5c8ff'
  on-primary-fixed: '#001c3a'
  on-primary-fixed-variant: '#004785'
  secondary-fixed: '#88fd54'
  secondary-fixed-dim: '#6de039'
  on-secondary-fixed: '#062100'
  on-secondary-fixed-variant: '#1a5200'
  tertiary-fixed: '#ffddb0'
  tertiary-fixed-dim: '#ffba45'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#614000'
  background: '#faf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 240px
---

## Brand & Style

The design system is engineered for a high-performance admin environment where educational content meets AI synthesis. The brand personality is **Professional, Systematic, and Visionary**. It balances the rigorous structure of an enterprise ERP (inspired by RuoYi-Vue) with the fluid, creative energy of a modern React-based AI workspace.

The design style is **Corporate Modern with a Creative Edge**. It utilizes a clean, light-mode foundation with high-density information layouts, contrasted by sophisticated glassmorphic accents in the "Production" modules to highlight the innovative nature of digital human synthesis. The UI should evoke a sense of reliability and technical mastery, ensuring users feel in control of complex AI workflows.

## Colors

The palette is anchored by **RuoYi Blue (#1890ff)**, signaling professional enterprise stability. This is supported by a functional spectrum of status colors specifically mapped to the AI production lifecycle:
- **Primary (Blue):** Actionable items, focus states, and "Processing" status.
- **Success (Green):** "Completed" status and positive confirmations.
- **Warning (Gold):** "Queuing" status and non-blocking alerts.
- **Error (Red):** "Failed" status and critical system errors.

The background uses a subtle **System Gray (#f0f2f5)** to create a layered effect against the white (#ffffff) card containers and sidebar, reducing eye strain during long production sessions.

## Typography

This design system utilizes **Inter** across all roles to ensure maximum legibility and a neutral, systematic feel. 

- **Hierarchy:** Strong contrast between bold headlines and regular body text allows for quick scanning of data-heavy tables.
- **Micro-Copy:** `label-caps` is used for table headers and section dividers to provide a clear structural anchor.
- **Numbers:** Tabular lining should be enabled for all data tables to ensure numerical alignment.
- **Mobile:** For screens below 768px, `display-lg` should scale down to 24px (headline-md) to maintain balance.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid grid**:
- **Sidebar:** Fixed width of 240px, collapsible to 64px. It maintains a clean white surface with a 1px solid border (`#f0f0f0`) on the right.
- **Top Header:** Fixed height of 64px, containing breadcrumbs and user profile.
- **Content Area:** Fluid 12-column grid with a 16px gutter. Content is housed within "Cards" that have a 24px internal padding.

**Breakpoints:**
- **Desktop (1200px+):** Full sidebar, 24px page margins.
- **Tablet (768px - 1199px):** Collapsed sidebar, 16px page margins.
- **Mobile (<767px):** Hidden sidebar (hamburger menu), 12px page margins, cards become full-width.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Low-Contrast Outlines** to define hierarchy:

1.  **Level 0 (Background):** The system gray (#f0f2f5) serves as the canvas.
2.  **Level 1 (Cards/Sidebar):** White surfaces with a subtle 1px border (#f0f0f0). No shadows are used for standard containers to keep the UI "flat" and professional.
3.  **Level 2 (Dropdowns/Modals):** These elements use a soft ambient shadow (Color: Primary-Dark, Alpha: 8%, Blur: 12px) to signify temporary interaction layers.
4.  **Level 3 (Active Production Items):** Items currently in 'Processing' may use a very subtle inner glow or a primary-colored left border (4px) to denote active focus.

## Shapes

The shape language is **Soft and Precise**. 
- **Buttons and Inputs:** Use a 4px (0.25rem) radius for a professional, slightly sharpened enterprise look.
- **Cards:** Use an 8px (0.5rem) radius to provide a modern, approachable feel to the workspace.
- **Status Badges:** Utilize a full-pill radius for maximum distinction from other UI elements.

## Components

### Buttons
- **Primary:** Solid RuoYi Blue with white text.
- **Secondary:** White background with RuoYi Blue border and text.
- **Ghost:** No background/border, used for secondary header actions.

### Status Badges
Badges consist of a small colored dot and text. 
- **Queuing:** Gold dot/text on light gold background.
- **Processing:** Blue dot/text with a subtle pulse animation on the dot.
- **Completed:** Green dot/text.
- **Failed:** Red dot/text.

### Input Fields
- **AI Prompt Area:** Large text areas with a monospaced font option for technical prompts.
- **Configuration Rails:** Side-aligned labels with 4px rounded inputs, utilizing `#f0f0f0` borders that turn Primary Blue on focus.

### Navigation
- **Sidebar:** Multi-level tree structure. Active parent items are highlighted with a Blue text color; active children have a light blue (#e6f7ff) background and a 3px right-side border.
- **Breadcrumbs:** Small, neutral-colored text following the path `Home / Production / Course Edit`.

### Cards
- Standard containers for "Course Overview" or "Character Selection". Headers should include a 1px bottom border and optional right-aligned action buttons.