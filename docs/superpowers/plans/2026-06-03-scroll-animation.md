# Scroll Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken homepage animation by implementing a seamless scroll-based IntersectionObserver fade-in/out for the hero and categories, working naturally on both PWA and desktop without hiding content.

**Architecture:** We will revert the `display: none` hack on the main content and instead use standard IntersectionObserver. As elements scroll into view, they fade in and slide up. As the hero scrolls out, its content fades out.

**Tech Stack:** Astro, CSS, Vanilla JS

---

### Task 1: Revert broken layout mechanics and set up baseline

**Files:**
- Modify: `src/pages/index.astro:43-200`
- Modify: `src/styles/global.css:300-365`

- [ ] **Step 1: Revert index.astro main hidden style**
  Remove `style="opacity: 0; display: none; transition: opacity 0.8s ease;"` from `<main id="main-content">`. Remove the `is-expanded` class from `<div class="hero-banner" id="hero-banner">`.

- [ ] **Step 2: Clean up index.astro script logic**
  Remove the `revealContent()` animation logic and `sessionStorage` references from the bottom script tag in `index.astro`. Keep only the filter logic.

- [ ] **Step 3: Revert global.css hero-banner styles**
  Remove the `.hero-banner.is-expanded` class rules and the `transition: height 0.8s` property from `.hero-banner`. Set `.hero-banner` back to `height: 60vh; min-height: 400px;` (or similar responsive height) so it looks good natively without forcing 100vh.

- [ ] **Step 4: Commit**
```bash
git add src/pages/index.astro src/styles/global.css
git commit -m "fix: revert broken display-none animation logic"
```

### Task 2: Implement smooth scroll-driven fade animations

**Files:**
- Modify: `src/styles/global.css:300-400`
- Modify: `src/pages/index.astro:78-200`

- [ ] **Step 1: Add CSS animation classes**
  In `global.css`, add classes for elements that should fade in.
```css
.fade-in-section {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  will-change: opacity, transform;
}
.fade-in-section.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 2: Apply animation classes to HTML**
  In `index.astro`, add the `fade-in-section` class to the category sections inside `<main>`.
```html
<section class="category-section fade-in-section" data-category={category}>
```

- [ ] **Step 3: Add IntersectionObserver JS**
  In the script block of `index.astro`, add:
```javascript
    document.addEventListener('DOMContentLoaded', () => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Optional: observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('.fade-in-section').forEach(section => {
        observer.observe(section);
      });
    });
```

- [ ] **Step 4: Commit**
```bash
git add src/pages/index.astro src/styles/global.css
git commit -m "feat: add seamless scroll-based fade animations"
```
