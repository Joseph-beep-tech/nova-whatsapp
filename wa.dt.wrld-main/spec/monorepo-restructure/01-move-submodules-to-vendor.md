# Phase 1: Move Submodules to vendor/

## Task ID: 054.1-move-submodules

## Objective

Relocate git submodules from `packages/` to `vendor/` to clearly separate external dependencies from custom code.

## Submodules to Move

| Submodule | Current Path | Target Path | Source |
|-----------|--------------|-------------|--------|
| whatsapp-api | `packages/whatsapp-api` | `vendor/whatsapp-api` | kulemantu/wwebjs-api fork |
| n8n | `packages/n8n` | `vendor/n8n` | n8n-io/n8n |

## Commands

```bash
# 1. Create vendor directory
mkdir -p vendor

# 2. Move submodules (git mv updates .gitmodules automatically)
git mv packages/whatsapp-api vendor/whatsapp-api
git mv packages/n8n vendor/n8n

# 3. Verify .gitmodules updated
cat .gitmodules
```

## Expected .gitmodules After

```ini
[submodule "vendor/whatsapp-api"]
	path = vendor/whatsapp-api
	url = https://github.com/kulemantu/wwebjs-api.git
	branch = main

[submodule "vendor/n8n"]
	path = vendor/n8n
	url = https://github.com/n8n-io/n8n.git
```

## Verification

- [ ] `git submodule status` shows `vendor/whatsapp-api` and `vendor/n8n` paths
- [ ] `.gitmodules` file reflects new paths
- [ ] No submodules remain in `packages/`

## Notes

- `git mv` for submodules automatically updates `.gitmodules`
- npm workspaces in `package.json` do NOT include submodules, so no changes needed there
- After this phase, docker-compose files will have broken paths - fixed in Phase 2

## Rollback

```bash
git mv vendor/whatsapp-api packages/whatsapp-api
git mv vendor/n8n packages/n8n
```
