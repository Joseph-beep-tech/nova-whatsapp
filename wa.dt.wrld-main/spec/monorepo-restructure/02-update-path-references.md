# Phase 2: Update Path References

## Task ID: 054.2-update-paths

## Objective

Update all docker-compose files and any other references to use the new `vendor/` paths.

## Files to Update

| File | Current Reference | New Reference |
|------|-------------------|---------------|
| `docker-compose.yml` (root) | `./packages/whatsapp-api` | `./vendor/whatsapp-api` |
| `packages/whatsapp-service/docker-compose.yml` | `../packages/whatsapp-api` | `../../vendor/whatsapp-api` |
| `packages/whatsapp-service/docker-compose.prod.yml` | Check for references | Update if present |

## Search for References

Before making changes, search for all occurrences:

```bash
# Find all references to packages/whatsapp-api
grep -r "packages/whatsapp-api" --include="*.yml" --include="*.yaml" --include="*.md" .

# Find all references to packages/n8n
grep -r "packages/n8n" --include="*.yml" --include="*.yaml" --include="*.md" .
```

## Root docker-compose.yml Changes

```yaml
# Before
services:
  whatsapp-api:
    build:
      context: ./packages/whatsapp-api

# After
services:
  whatsapp-api:
    build:
      context: ./vendor/whatsapp-api
```

## whatsapp-service/docker-compose.yml Changes

```yaml
# Before
services:
  whatsapp-api:
    build:
      context: ../packages/whatsapp-api

# After
services:
  whatsapp-api:
    build:
      context: ../../vendor/whatsapp-api
```

## Verification

```bash
# Validate compose syntax
docker compose config

# Validate service compose
docker compose -f packages/whatsapp-service/docker-compose.yml config

# Test build (no cache to ensure fresh paths)
docker compose build --no-cache whatsapp-api
```

## Checklist

- [ ] Root `docker-compose.yml` updated
- [ ] `packages/whatsapp-service/docker-compose.yml` updated
- [ ] `packages/whatsapp-service/docker-compose.prod.yml` checked/updated
- [ ] `docker compose config` validates without errors
- [ ] `docker compose build` succeeds
- [ ] No grep results for old paths

## Notes

- The path from `packages/whatsapp-service/` to `vendor/` is `../../vendor/` (up two levels)
- The path from root to `vendor/` is `./vendor/` (same level)
