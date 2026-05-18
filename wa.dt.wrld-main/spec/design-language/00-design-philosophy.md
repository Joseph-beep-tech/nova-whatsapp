# Design Philosophy: Modern Orchestration
This document defines the visual and interaction principles for the WhatsApp Orchestration Dashboard.

## 1. Aesthetic: "Modern Functionalist"
The interface should feel like a high-end command center—precise, clean, and professional, yet soft and approachable.

- **Shadcn-like Base:** Use a neutral background (Zinc or Slate) as the canvas.
- **Soft Gradients:** Subtle, non-distracting background gradients (e.g., from top-left to bottom-right) using deep rich colors for depth.
- **Translucency (Glassmorphism):** Use `backdrop-blur` and low-opacity fills for panels, cards, and navigation bars to maintain context and depth.
- **Rich Palette:** 
  - **Primary:** Deep Emerald or Indigo for brand/status.
  - **Status:** Vibrant but balanced Green (Success), Rose (Error), Amber (Warning), Sky (Info).
  - **Surface:** Glass-like translucency with fine 1px borders (Zinc-800/20 in dark, Zinc-200/50 in light).

## 2. Layout Strategy
- **Minimal Navigation:** Reduced sidebar complexity; focus on high-level master actions.
- **Side-by-Side Context:** Favor split-panes and multi-column views over full-page transitions.
- **Bottom Panels over Modals:** Use sliding bottom drawers or integrated expandable panels for details and configurations to keep the main view visible.

## 3. Interaction Defaults
- **Resizing:** Elegant transitions when panels are toggled or resized.
- **Grouping:** Use Accordions for long property lists and Tabs for distinct but related data sets (e.g., Session Health vs. Session Logs).
