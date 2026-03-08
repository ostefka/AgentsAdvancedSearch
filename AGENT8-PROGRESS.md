# Agent #8 — M365 Agents SDK Custom Engine Agent

## Goal
Custom engine agent with Azure AI Search, deployed to Azure Container App (same VNet as MCP server), published to M365 Copilot.

## Architecture
```
M365 Copilot / Teams
    → Azure Bot Service (free)
        → Container App (agent) [mcp-aisearch-vnet, NAT GW → static IP]
            → Azure AI Search (direct SDK, hybrid + semantic + query rewriting)
            → Azure OpenAI (embeddings + chat)
```

## Existing Infrastructure (reused)
| Resource | Name | RG |
|---|---|---|
| VNet | mcp-aisearch-vnet (10.0.0.0/16) | rg-mcp-aisearch |
| Container App Env | mcp-aisearch-env-v2 | rg-mcp-aisearch |
| ACR | mcpaisearchacr.azurecr.io | rg-mcp-aisearch |
| AI Search | search-airlift-s1 (S1) | rg-mcp-aisearch |
| Azure OpenAI | openai-airlift-2025 | rg-mcp-aisearch |
| NAT Gateway | mcp-aisearch-natgw (IP: 4.223.109.98) | rg-mcp-aisearch |
| Managed Identity | mcp-aisearch-identity | rg-mcp-aisearch |

## New Resources Needed
| Resource | Name | Notes |
|---|---|---|
| Container App | agent-aisearch-app | Same env as MCP server |
| Bot Service | agent-aisearch-bot | Free tier, Azure Bot |
| Entra ID App | Agent-AISearch-Bot | Bot framework identity |

## Progress Log

### Step 1: Project Scaffold ✅
- Created TypeScript project based on Teams SDK / custom engine agent pattern
- Reused search-service.ts from mcp-aisearch project (hybrid search + query rewriting)
- Added Bot Framework adapter + activity handler
- Configured for M365 Copilot (manifest v1.22 with copilotAgents.customEngineAgents)

### Step 2: Implementation ✅
- Bot activity handler with smart search (query rewriting + hybrid search)
- Azure OpenAI RAG answer generation with citations
- Markdown response formatting with source links
- Health endpoint at /health

### Step 3: Azure Deployment ✅
- ACR image: `mcpaisearchacr.azurecr.io/agent-aisearch:v1`
- Container App: `agent-aisearch-app` in `mcp-aisearch-env-v2` (same VNet as MCP server)
- FQDN: `https://agent-aisearch-app.redsand-292853fe.swedencentral.azurecontainerapps.io`
- Health: ✅ OK
- Entra ID App: `Agent-AISearch-Bot` (appId: `618322ad-4119-4fe4-bd31-4ab4a81d7e98`)
- Bot Service: `agent-aisearch-bot` (F0 free tier)
- Teams channel: ✅ Enabled
- Managed Identity: Uses `mcp-aisearch-identity` (clientId: `ae9100ce-50cc-4c28-8305-1c7eb1f2057f`)

### Step 4: M365 Copilot
- [ ] Create app package icons (color.png 192x192, outline.png 32x32)
- [ ] Fill manifest.json with actual IDs
- [ ] Zip app package
- [ ] Sideload to tenant
- [ ] Test in M365 Copilot

## Key Decisions
- **Framework**: Teams SDK (teamsai v2) — TypeScript, matches coffee-agent sample
- **Search**: Direct Azure AI Search SDK — hybrid + semantic + query rewriting (reused from mcp-aisearch)
- **Hosting**: Container App in same VNet → same NAT GW IP → already whitelisted in AI Search
- **Auth for search**: Managed Identity (same as MCP server) — no OBO for this comparison
- **Manifest**: v1.22 with copilotAgents.customEngineAgents for M365 Copilot publishing
