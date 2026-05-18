# Tailwind CSS Setup for Admin UI

The admin UI uses locally-bundled Tailwind CSS instead of the CDN to comply with Content Security Policy (CSP) restrictions.

## Why Not CDN?

The Tailwind CDN approach (`<script src="https://cdn.tailwindcss.com">`) has issues in production:

1. **CSP Violations:** Many production environments block external scripts
2. **Reliability:** External dependency that could fail
3. **Performance:** Extra DNS lookup and connection
4. **Caching:** Less control over browser caching

## Build Process

### Prerequisites

The following dev dependencies are installed:

```json
{
  "devDependencies": {
    "tailwindcss": "^4.x",
    "@tailwindcss/cli": "^4.x"
  }
}
```

### Building CSS

```bash
cd packages/whatsapp-service

# Build CSS only
npm run build:css

# Full build (includes CSS)
npm run build
```

The build script:
```json
{
  "scripts": {
    "build:css": "tailwindcss -i ./src/styles/input.css -o ./src/views/styles.css --minify"
  }
}
```

### Input File

**Location:** `src/styles/input.css`

```css
@import "tailwindcss";

/* Configure content sources for Tailwind v4 */
@source "../views/**/*.html";
```

The `@source` directive tells Tailwind which files to scan for class usage.

### Output File

**Location:** `src/views/styles.css`

- Generated automatically by `npm run build:css`
- Contains only the CSS classes actually used in HTML files
- Minified for production (~14KB)
- Committed to git for deployment simplicity

---

## Tailwind v4 Differences

This project uses Tailwind CSS v4, which has significant differences from v3:

### Configuration

| v3 Approach | v4 Approach |
|-------------|-------------|
| `tailwind.config.js` file | CSS-first with directives |
| `content: [...]` array | `@source "..."` directive |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Single `tailwindcss` package | Requires `@tailwindcss/cli` |

### No Config File Needed

Tailwind v4 doesn't require `tailwind.config.js`. All configuration is done in CSS:

```css
@import "tailwindcss";
@source "../views/**/*.html";

/* Custom theme extensions (if needed) */
@theme {
  --color-brand: #3b82f6;
}
```

---

## Adding New Classes

If you add HTML that uses Tailwind classes not currently in the output CSS:

1. Add the HTML with new classes
2. Run `npm run build:css`
3. Verify the new classes appear in `styles.css`
4. Commit both the HTML and updated CSS

### Example

Adding a new alert component:

```html
<!-- New alert using classes not yet in CSS -->
<div class="bg-amber-100 border-amber-500 text-amber-700 p-4 rounded">
  Warning message
</div>
```

After running `build:css`, amber color utilities will be included in the output.

---

## Customization

### Adding Custom Styles

Add custom CSS after the Tailwind import:

```css
@import "tailwindcss";
@source "../views/**/*.html";

/* Custom styles */
.custom-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg;
}
```

### Theme Extensions

Use the `@theme` directive for custom design tokens:

```css
@import "tailwindcss";

@theme {
  /* Custom colors */
  --color-brand-primary: oklch(0.7 0.15 250);
  --color-brand-secondary: oklch(0.6 0.12 200);

  /* Custom spacing */
  --spacing-18: 4.5rem;
}
```

---

## Deployment Notes

### Docker

The CSS file is committed to git and copied during Docker build:

```dockerfile
# In Dockerfile.prod
COPY src/views/ ./src/views/  # Includes styles.css
```

No build step needed in the container.

### CI/CD

If using CI/CD pipelines, you can optionally verify CSS is up-to-date:

```bash
# Build CSS
npm run build:css

# Check for uncommitted changes
git diff --exit-code src/views/styles.css || {
  echo "Error: CSS needs to be rebuilt and committed"
  exit 1
}
```

---

## Troubleshooting

### Missing Classes

**Symptom:** Some Tailwind classes don't apply.

**Fix:**
1. Ensure the class is used in a scanned file (`src/views/**/*.html`)
2. Run `npm run build:css`
3. Check `styles.css` includes the class

### Build Errors

**Symptom:** `tailwindcss: command not found`

**Fix:**
```bash
npm install
# Or specifically:
npm install -D tailwindcss @tailwindcss/cli
```

### Large Output File

**Symptom:** `styles.css` is unexpectedly large.

**Possible causes:**
- `@source` pattern too broad (scanning node_modules)
- Dynamic class names in JavaScript

**Fix:** Verify `@source` patterns are specific to your HTML files.

---

## References

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Tailwind CLI Installation](https://tailwindcss.com/docs/installation/tailwind-cli)
- [Upgrade Guide v3 to v4](https://tailwindcss.com/docs/upgrade-guide)
