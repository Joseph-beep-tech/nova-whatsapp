# Documentation Index

## Overview

This folder contains all technical documentation for the WhatsApp automation platform. Files are indexed with numeric prefixes for clear ordering within each section.

---

## 📱 WhatsApp API

**WhatsApp API setup and configuration**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [whatsapp-api-setup](whatsapp/01-whatsapp-api-setup.md) | Complete setup guide for wwebjs-api |
| 02 | [api-reference](whatsapp/02-api-reference.md) | Full endpoint reference |
| 03 | [service-api-reference](whatsapp/03-service-api-reference.md) | whatsapp-service API reference |
| 04 | [whatsapp-service-session](whatsapp/04-whatsapp-service-session.md) | Service development session notes |
| 05 | [developer-api-guide](whatsapp/05-developer-api-guide.md) | **Quick start for developers** |
| 06 | [learning-progress-api](whatsapp/06-learning-progress-api.md) | Learning progress management API |
| 07 | [learning-progress-api-spec](whatsapp/07-learning-progress-api-spec.md) | **NEW** - Full API specification |

---

## 🔌 n8n Integration

**n8n workflows and node development**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [n8n-integration-v2](n8n/01-n8n-integration-v2.md) | **n8n 2.x integration guide** (current) |
| 02 | [n8n-node-development](n8n/02-n8n-node-development.md) | Developing custom n8n nodes |
| 03 | [n8n-compatibility-fixes](n8n/03-n8n-compatibility-fixes.md) | Required fixes for full compatibility |
| 04 | [n8n-integration-v1](n8n/04-n8n-integration-v1.md) | Integration guide (v1 - legacy) |
| 05 | [n8n-nodes-deployment](n8n/05-n8n-nodes-deployment.md) | **Custom nodes deployment guide** |
| 06 | [n8n-session-notes](n8n/06-n8n-session-notes.md) | n8n development session notes |
| 07 | [whatsapp-api-quickstart](n8n/07-whatsapp-api-quickstart.md) | Quick start for n8n + WhatsApp |

### n8n Incidents

| Date | Document | Description |
|------|----------|-------------|
| 2026-01-21 | [router-feedback-loop](n8n/incidents/2026-01-21-router-feedback-loop.md) | WhatsApp router feedback loop fix |
| 2026-01-29 | [welcome-message-fixes](n8n/incidents/2026-01-29-welcome-message-fixes.md) | Welcome message production fixes |

---

## 🔍 Qdrant Vector Database

**Vector database for RAG and semantic search**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [qdrant-setup](qdrant/01-qdrant-setup.md) | Setup, configuration, and troubleshooting |

---

## 🖥️ Admin UI

**Admin interface for monitoring and management**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [admin-ui-overview](admin/01-admin-ui-overview.md) | Admin pages, authentication, features |
| 02 | [tailwind-css-setup](admin/02-tailwind-css-setup.md) | CSS build process and customization |

---

## 💬 Dashboard

**Customer-centric HITL interface for WhatsApp conversations**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [dashboard-overview](dashboard/01-dashboard-overview.md) | **START HERE** - Architecture, screens, components |
| 02 | [authentication](dashboard/02-authentication.md) | Auth flow, roles, protected routes |
| 03 | [testing](dashboard/03-testing.md) | Vitest setup, test patterns, coverage |

---

## 📐 Architecture

**Core design and system structure**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [architecture-overview](architecture/01-architecture-overview.md) | **START HERE** - Complete architecture summary |
| 02 | [mongodb-integration](architecture/02-mongodb-integration.md) | MongoDB state storage integration |
| 03 | [architecture-refactor-summary](architecture/03-architecture-refactor-summary.md) | Detailed before/after analysis |
| 04 | [architecture-legacy](architecture/04-architecture-legacy.md) | Pre-refactor architecture (archived) |
| 05 | [memory-schema-enhancements](architecture/05-memory-schema-enhancements.md) | **NEW** - Hybrid search, threads, summaries |

---

## 🚀 Deployment

**Production deployment guides**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [deployment-plan](deployment/01-deployment-plan.md) | Production deployment plan |
| 02 | [server-changes](deployment/02-server-changes.md) | Server configuration changes |
| 03 | [deployment-log](deployment/03-deployment-log.md) | Deployment history |
| 04 | [bridging-layer-setup](deployment/04-bridging-layer-setup.md) | Bridging layer production setup |
| 05 | [deployment-migration](deployment/05-deployment-migration.md) | **Git-based deployment guide** |
| 055 | [router-fix-session](deployment/055-router-fix-session.md) | Router fix session notes |

---

## 📚 Guides

**How-to guides and troubleshooting**

| Index | Document | Description |
|-------|----------|-------------|
| 01 | [troubleshooting](guides/01-troubleshooting.md) | Common issues and solutions |
| 02 | [debugging-strategies](guides/02-debugging-strategies.md) | Debugging n8n and WhatsApp integrations |
| 03 | [saving-learning-progress](guides/03-saving-learning-progress.md) | **NEW** - Developer guide for progress tracking |

---

## 📦 Archive

**Historical documentation (kept for reference)**

- [IMPROVEMENTS.md](archive/IMPROVEMENTS.md) - Legacy improvement proposals
- [REDUNDANT_FILES.md](archive/REDUNDANT_FILES.md) - Files removed during refactor

---

## Quick Links

### Getting Started
1. Read [architecture-overview](architecture/01-architecture-overview.md) to understand the system
2. Check [../README.md](../README.md) for quick start guide
3. Review [whatsapp-api-setup](whatsapp/01-whatsapp-api-setup.md) for WhatsApp API setup
4. Review [n8n-integration-v2](n8n/01-n8n-integration-v2.md) for n8n 2.x setup

### Development
1. See [../CLAUDE.md](../CLAUDE.md) for development guidelines
2. Review [n8n-node-development](n8n/02-n8n-node-development.md) for node development
3. Review [n8n-nodes-deployment](n8n/05-n8n-nodes-deployment.md) for deploying custom nodes
4. Check [troubleshooting](guides/01-troubleshooting.md) if issues arise
5. Use [debugging-strategies](guides/02-debugging-strategies.md) for complex issues

### Deployment
1. Review [deployment-plan](deployment/01-deployment-plan.md)
2. Check [deployment-log](deployment/03-deployment-log.md) for history
3. Verify [server-changes](deployment/02-server-changes.md) for config

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| 01-dashboard-overview.md | ✅ Current | 2026-02 |
| 02-authentication.md | ✅ Current | 2026-02 |
| 03-testing.md | ✅ Current | 2026-02 |
| 01-admin-ui-overview.md | ✅ Current | 2026-02 |
| 02-tailwind-css-setup.md | ✅ Current | 2026-02 |
| 01-qdrant-setup.md | ✅ Current | 2026-01 |
| 01-whatsapp-api-setup.md | ✅ Current | 2026-01 |
| 03-service-api-reference.md | ✅ Current | 2026-01 |
| 04-whatsapp-service-session.md | ✅ Current | 2026-01 |
| 05-developer-api-guide.md | ✅ Current | 2026-01 |
| 06-learning-progress-api.md | ✅ Current | 2026-01 |
| 07-learning-progress-api-spec.md | ✅ Current | 2026-01 |
| 03-saving-learning-progress.md | ✅ Current | 2026-01 |
| 01-n8n-integration-v2.md | ✅ Current | 2026-01 |
| 06-n8n-session-notes.md | ✅ Current | 2026-01 |
| 07-whatsapp-api-quickstart.md | ✅ Current | 2026-01 |
| incidents/2026-01-21-*.md | ✅ Current | 2026-01 |
| incidents/2026-01-29-*.md | ✅ Current | 2026-01 |
| 05-deployment-migration.md | ✅ Current | 2026-01 |
| 055-router-fix-session.md | ✅ Current | 2026-01 |
| 02-debugging-strategies.md | ✅ Current | 2026-01 |
| 05-n8n-nodes-deployment.md | ✅ Current | 2026-01 |
| 01-architecture-overview.md | ✅ Current | 2024-11 |
| 02-mongodb-integration.md | ✅ Current | 2024-11 |
| 03-architecture-refactor-summary.md | ✅ Current | 2024-11 |
| 05-memory-schema-enhancements.md | ✅ Current | 2026-01 |
| 02-n8n-node-development.md | ✅ Current | 2024-11 |
| 03-n8n-compatibility-fixes.md | ✅ Current | 2024-11 |
| 04-n8n-integration-v1.md | ⚠️ See v2 | 2024-11 |
| 04-architecture-legacy.md | 📦 Archived | Pre-refactor |
| 01-troubleshooting.md | ⚠️ Needs Review | Unknown |
| 01-deployment-plan.md | ⚠️ Needs Review | Unknown |
| 02-server-changes.md | ⚠️ Needs Review | Unknown |
| 03-deployment-log.md | ⚠️ Needs Update | Unknown |

---

## File Naming Convention

Files use indexed prefixes for clear ordering:
- `{NN}-{descriptive-name}.md` (e.g., `01-whatsapp-api-setup.md`)
- Lower numbers = higher importance or recommended reading order
- Index `01` = primary/recommended document in each section

### Status Indicators
- ✅ Current - Up to date with latest changes
- ⚠️ Needs Update - Contains outdated information
- 📦 Archived - Historical reference only

---

## Root-Level Documentation

These files remain in the project root:
- [**CLAUDE.md**](../CLAUDE.md) - Development guidelines for Claude Code
- [**README.md**](../README.md) - Project overview and quick start
- [**tasks.json**](../tasks.json) - Task tracking
