---
name: fps-performance-optimizer
description: >-
  Optimize website UI, components, and data fetching to eliminate lag, prevent freezes, and achieve smooth 60fps rendering. Triggered by phrases like "sayt qotyapti", "qotib qoldi", "lag", "fps", "silliq", "sekin", "optimallashtir", "smoothness", "performance optimization".
---

# FPS Performance Optimizer

## Overview
This skill focuses on identifying, debugging, and resolving performance bottlenecks in the frontend/UI. When the user reports that a page, modal, form, or list is lagging (`qotyapti`, `sekin`), this skill guides the assistant to optimize code execution, rendering efficiency, and animations to ensure a solid, stutter-free 60fps user experience.

## Dependencies
None.

## Quick Start
1. **Locate the lagging component**: Identify the component or view causing lag (e.g., modals, long lists, heavy forms, real-time search).
2. **Audit for render & execution issues**: Look for unneeded re-renders, heavy computations inside render cycles, missing virtual lists, and synchronous blocking calls.
3. **Optimize rendering loop**: Use React memoization (`React.memo`, `useMemo`, `useCallback`), split state to isolate changes, and implement virtualization or pagination for large data sets.
4. **Ensure CSS hardware acceleration**: Optimize animations using `transform` and `opacity` to avoid layout thrashing.
5. **Verify frame rates (60fps)**: Ensure interactions are highly responsive, smooth, and do not freeze the main thread.

## Workflow

### 1. Identify & Diagnose the Lag (Muammoni aniqlash)
Understand why the UI is stuttering:
- **Excessive Re-renders**: A parent component updates, causing dozens of heavy children to re-render unnecessarily.
- **Heavy List Rendering**: Trying to render hundreds of items with complex UI layouts directly into the DOM at once.
- **Main Thread Blocking**: Expensive JavaScript calculations (sorting, searching, mapping) running synchronously during the render cycle.
- **Non-Performant Animations**: Using properties like `top`, `left`, `margin`, `width`, or `height` for animations which force constant layout recalculation (reflow).
- **Unthrottled Event Listeners**: Listening to window scroll, resize, or keyboard input searches without debouncing or throttling.

### 2. React Render Optimization
Apply the following rules to minimize rendering costs:
- **React.memo**: Wrap expensive leaf components in `React.memo` so they only re-render when their primitive props actually change.
- **useMemo & useCallback**: Use `useMemo` for complex data mapping, filtering, or calculations. Use `useCallback` for handler functions passed as props to memoized children to maintain reference equality.
- **State Colocalization**: Avoid placing every state variable in the top-level parent or global store. Keep state as close as possible to the component that actually uses it to prevent full-page re-renders.
- **Lazy Rendering / Code Splitting**: Render heavy modals or off-screen panels dynamically (only when open) rather than keeping them hidden in CSS (`display: none`).

### 3. List & Table Optimization (Katta ro'yxatlar)
- **Virtualization**: For lists or tables with more than 50-100 rows, use virtualization/windowing (e.g., only render visible items in the viewport) or clean pagination.
- **Stable React Keys**: Never use `Math.random()`, dynamic IDs, or array indices as React keys if the list can be sorted, filtered, or mutated. Use a unique database ID or stable identifier.

### 4. Layout and CSS Optimization (60fps animation)
- **Composite Properties Only**: For animations, transitions, and hover states, only animate `transform` (scale, translate, rotate) and `opacity`. Avoid animating layout-triggering properties (`height`, `width`, `padding`, `top`, `left`).
- **Will-Change**: Use `will-change: transform, opacity` sparingly on elements that undergo intensive CSS animations to hint to the browser to use GPU acceleration.
- **Avoid Layout Thrashing**: Never read layout metrics (e.g., `element.offsetHeight`) and immediately write to them in the same cycle. Batch layout reads and writes.

### 5. Input & Event Optimization (Kiritish maydonlari)
- **Debouncing**: For real-time searches or text inputs, debounce the state update or API trigger (e.g., wait 300ms after the user stops typing before searching).
- **Throttling**: Throttle scroll, resize, or mouse-move handlers to run at most once every 16ms (60fps frame budget).

## Common Mistakes
- **Memoizing Everything**: Overusing `useMemo` on simple variables or cheap calculations adds overhead and memory pressure. Only memoize expensive operations.
- **Hiding with CSS instead of Unmounting**: Keeping heavy UI segments loaded in the DOM using `display: none`. Always conditionally render heavy elements (`{isOpen && <HeavyModal />}`).
- **Running CPU-heavy code in the render cycle**: Transforming raw API data inside the return statement of a React component. Do it inside a `useMemo` hook or on the backend.
