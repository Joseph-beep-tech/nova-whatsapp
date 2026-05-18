# Layout & Navigation Architecture

## 1. Top Bar (Global Shortcuts)
The persistent top bar acts as the primary utility hub.
- **Left:** App Logo + Global Search.
- **Right (Icon-based):**
  - **Alerts:** Bell icon with badge; opens a right-side drawer.
  - **Profile:** Avatar with dropdown for account details.
  - **Settings:** Gear icon for system-wide configs.
  - **Support:** Help circle for documentation/contact.

## 2. Left Sidebar (Master Actions)
Minimal, focused on structural navigation.
- **Dashboard Overview:** The main orchestration view.
- **RBAC:** User management, Roles, and PATs.
- **System Settings:** Global service configuration.
- **Billing/Usage:** Quotas and credit tracking.

## 3. Top Tabs (Multi-Instance)
In the Dashboard view, instances are managed via horizontal tabs at the top of the main content area.
- Each tab represents a **WhatsApp Number/Session**.
- **Active state:** Highlighted with a subtle underline or glass lift.
- **Status indicators:** Small colored dot (Green/Yellow/Red) in the tab label.

## 4. Bottom Panels (Detail Focus)
Avoid floating dialogs for configuration.
- Use a **Bottom Panel** (Drawer) that slides up for:
  - Message details.
  - Edit routing rules.
  - Key creation (one-time reveal).
  - Advanced session telemetry.
