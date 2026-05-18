# Monorepo Restructure: Separate Submodules from Custom Packages

## Problem Statement

1. Modifying `/var/www/wa.dater.world/whatsapp-api/docker-compose.yml` on the server dirties the git submodule
2. `packages/` mixes custom code with external submodules - unclear what's "ours"
3. Deployment configs scattered across multiple locations

## Current State

```
packages/
├── whatsapp-api/         ← SUBMODULE (kulemantu/wwebjs-api fork)
├── n8n/                  ← SUBMODULE (n8n-io/n8n)
├── whatsapp-service/ ← CUSTOM (npm workspace)
└── whatsapp-n8n-nodes/   ← CUSTOM (npm workspace)
```

## Target State

```
wa-chatbot-local/
├── packages/                       # CUSTOM CODE ONLY (npm workspaces)
│   ├── whatsapp-service/
│   ├── whatsapp-n8n-nodes/
│   └── whatsapp-frontend/          (if added later)
│
├── vendor/                         # EXTERNAL GIT SUBMODULES (read-only)
│   ├── whatsapp-api/               ← moved from packages/
│   └── n8n/                        ← moved from packages/
│
├── deploy/                         # DEPLOYMENT CONFIGS (custom)
│   ├── whatsapp-api/
│   │   ├── docker-compose.yml      # Production config
│   │   ├── docker-compose.override.yml  # Server-specific (gitignored)
│   │   └── .env.example
│   ├── whatsapp-service/
│   │   └── docker-compose.yml      # Prod config (or symlink)
│   └── README.md
│
├── docker-compose.yml              # Root: local dev orchestration
├── .gitmodules                     # Updated paths → vendor/
└── package.json                    # Workspaces unchanged
```

## Implementation Phases

| Phase | Document | Description | Task ID |
|-------|----------|-------------|---------|
| 1 | [01-move-submodules-to-vendor.md](./01-move-submodules-to-vendor.md) | Move submodules to vendor/ | 054.1 |
| 2 | [02-update-path-references.md](./02-update-path-references.md) | Update docker-compose paths | 054.2 |
| 3 | [03-create-deploy-directory.md](./03-create-deploy-directory.md) | Create deploy/ structure | 054.3 |
| 4 | [04-update-gitignore.md](./04-update-gitignore.md) | Update .gitignore | 054.4 |
| 5 | [05-server-migration.md](./05-server-migration.md) | Server migration with data preservation | 054.5 |

## Benefits

| # | Benefit |
|---|---------|
| 1 | **Clear ownership** - `packages/` = our code, `vendor/` = external |
| 2 | **Clean submodules** - Never modify vendor/, deploy configs in deploy/ |
| 3 | **Deployment isolation** - Server-specific configs gitignored |
| 4 | **Consistent pattern** - Both whatsapp-api and n8n treated the same |
| 5 | **npm workspaces unaffected** - Only custom packages in workspaces |

## Task Reference

See `tasks.json` task ID: `054-20260127-monorepo-restructure`
