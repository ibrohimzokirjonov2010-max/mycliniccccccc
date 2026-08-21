---
name: ui-section-optimizer
description: >-
  Refactor, clean, and structure a specific section or component of a website's UI to make it look professional, compact, and organized without breaking the existing style theme. Triggered by phrases like "professional qilib ber", "tartibga sol", "ixchamlashtir", "ramkalarga sol", "dizaynni yangila", "clean layout", "make compact".
---

# UI Section Optimizer

## Overview
This skill focuses on taking an existing, cluttered, or simple UI section (such as forms, lists, settings panels, or control widgets) and refactoring its HTML/CSS/JSX to be modern, structured, compact, and professional. The goal is to clean up layout hierarchy and group related items using cards, containers, and borders, while strictly preserving the existing design aesthetic (colors, fonts, brand identity) and avoiding breaking changes.

## Dependencies
None.

## Quick Start
When a user asks to optimize a section or make it professional/compact:
1. Locate the file containing the section (e.g., a React component or HTML/CSS structure).
2. Auto-detect the tech stack (React/JSX, plain HTML, CSS modules, Tailwind, etc.).
3. Restructure the components into neat, card-based boxes or structured grids.
4. Keep styles clean, compact, and easy to interact with.
5. Apply the changes strictly to the target area.

## Workflow

### 1. Stack & Scope Detection
Identify the programming language, framework, and styling strategy. Do not introduce new libraries (like Tailwind or Radix UI) unless already present and used in the file. Keep the technology consistent with the current file structure.

### 2. Preserve Site Aesthetics (Dizaynni Buzmaslik)
Do not change:
- Global theme colors (primary, background, text colors).
- Global typography styles (font-family, base font sizes).
- Existing state management, event handlers, or database connection logic.

### 3. Compact & Structured Card Layout (Ixcham va Ramkalangan)
- Group scattered inputs, labels, and buttons into distinct, border-framed or background-shaded containers (`div` with borders, card styles, or container components).
- Use CSS Flexbox/Grid for neat alignment.
- Reduce excessive padding/margins to make the section compact (`ixcham`) while maintaining a professional spacing hierarchy (usually 12px to 20px gap/padding).
- Use rounded corners (`border-radius: 8px` to `12px`) and subtle shadows (`box-shadow`) to create depth.

### 4. Usability Enhancements (Qulaylik)
- Add transition effects on hover states for buttons, links, and card interactions.
- Ensure form fields have clear visual focus states.
- Clean up text alignment, making sure labels are clearly paired with inputs.
- Organize actions (like Save, Cancel, Delete buttons) logically, usually in a clean bottom bar of the card/frame.

### 5. Targeted Implementation
Only update the specific section in question. Do not rewrite imports, context providers, API endpoints, or sidebars that are not part of the requested UI optimization.

## Common Mistakes
- **Breaking Layout Theme:** Changing global CSS styles that affect other pages. Always isolate styles to the specific component/section.
- **Over-padding:** Making elements too large or spaced out. The user explicitly requested compact layouts (`ixchamlashtirish`).
- **Rewriting Business Logic:** Accidently altering hooks, fetch calls, or state variable names during restructuring. Keep logic identical, only refactoring the markup/styling.
