# Components & Visual Cues

## 1. Iconography
- **Set:** Modern Outline SVG set (e.g., Lucide-React or Heroicons).
- **Style:** 1.5px to 2px stroke width; consistent bounding box (24x24).
- **Usage:** Always paired with labels in menus; used solo only in the Top Bar shortcuts.

## 2. Glass Cards
Containers for logs, session cards, and chat threads.
- **Background:** `bg-zinc-900/40` (Dark) / `bg-white/40` (Light).
- **Blur:** `backdrop-blur-md`.
- **Border:** `border border-white/10` (Dark) / `border-black/5` (Light).
- **Shadow:** Subtle soft shadow for lift.

## 3. Specialized Controls
- **Tabs/Accordions:** Preferred for navigating metadata side-by-side with streams.
- **Resizers:** Draggable borders for multi-pane layouts (Sessions card vs. Details).
- **Manual Send (Takeover):** A fixed bottom area in the chat thread, glass-styled, with a clear "Human Takeover Active" indicator.

## 4. Status Indicators
- Use soft-glowing dots for "Live" status.
- **Connected:** Pulsing Emerald.
- **Action Required:** Pulsing Amber (e.g., QR Code).
- **Disconnected:** Static Rose.
