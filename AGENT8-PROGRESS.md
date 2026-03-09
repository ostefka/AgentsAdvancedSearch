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

### Step 4: M365 Copilot ✅
- App manifest v1.22 with `copilotAgents.customEngineAgents`
- Sideloaded to tenant manually
- **Tested successfully in M365 Copilot** — agent receives Czech queries, runs hybrid search + query rewriting, returns RAG answers with citations

## Phase 2: Teams SDK v2 + SSO + OBO + Adaptive Cards

### Framework Migration
- **From:** `botbuilder` (raw Bot Framework SDK)
- **To:** `@microsoft/teams.apps` + `@microsoft/teams.ai` + `@microsoft/teams.cards` (Teams SDK v2)

### Progress
1. **Bot auth config** — `ConfigurationBotFrameworkAuthentication` needs `ConfigurationServiceClientCredentialFactory` as 2nd arg, not config in 1st arg
2. **Missing service principal** — `az ad sp create` needed for the bot app registration (AADSTS7000229)
3. **Missing managed identity** — Container App needed user-assigned MI for AI Search/OpenAI access
4. **AI Search IP firewall** — temporarily disabled for testing (Container App outbound IPs differ from MCP server's NAT GW)
5. **Wrong index name** — corrected to `spo-methodics-v1`
6. **Wrong embedding deployment** — switched from `text-embedding` (ada-002, 1536d) to `text-embedding-3-large` (3072d) to match index
7. **Wrong answer deployment** — switched from `gpt-4o` (doesn't exist) to `gpt-4o-mini`

## AI Search Firewall Status
- **RESTORED** — original IP rules back in place
- Original rules: `4.223.109.98` (NAT GW), `81.90.252.204` (dev machine), `9.223.238.69`
- ⚠️ Agent #8 Container App outbound IPs are NOT in the allowed list — agent won't work until resolved
- **To fix permanently:** Either route Container App through the same NAT Gateway (requires VNet infrastructure work) or add Container App outbound IPs (61 IPs, not practical)

## Deployment Checklist (for next time)

### Prerequisites
- [ ] Azure subscription with Container Apps, ACR, Bot Service
- [ ] Existing AI Search index with vector field
- [ ] Existing Azure OpenAI with embedding + chat deployments
- [ ] VNet with NAT Gateway (if IP-filtered AI Search)

### Step-by-step (15 commands)

```bash
# 1. Create Entra ID app registration
az ad app create --display-name "Agent-AISearch-Bot" --sign-in-audience "AzureADMyOrg"

# 2. Create service principal (CRITICAL - without this bot can't get tokens)
az ad sp create --id <APP_ID>

# 3. Create client secret
az ad app credential reset --id <APP_ID> --years 2

# 4. Build container image in ACR
az acr build --registry <ACR_NAME> --image agent-aisearch:v1 --file Dockerfile .

# 5. Create Container App (with managed identity for AI Search access)
az containerapp create \
  --name agent-aisearch-app \
  --resource-group <RG> \
  --environment <CAE_NAME> \
  --image <ACR>.azurecr.io/agent-aisearch:v1 \
  --registry-server <ACR>.azurecr.io \
  --registry-username <ACR> \
  --registry-password <ACR_PASS> \
  --target-port 3978 \
  --ingress external \
  --min-replicas 1 --max-replicas 1

# 6. Assign managed identity to Container App
az containerapp identity assign -n agent-aisearch-app -g <RG> --user-assigned <MI_RESOURCE_ID>

# 7. Set environment variables
az containerapp update -n agent-aisearch-app -g <RG> --set-env-vars \
  "BOT_ID=<APP_ID>" \
  "BOT_PASSWORD=<SECRET>" \
  "BOT_TENANT_ID=<TENANT_ID>" \
  "AZURE_SEARCH_ENDPOINT=https://<SEARCH>.search.windows.net" \
  "AZURE_SEARCH_INDEX_NAME=<INDEX>" \
  "AZURE_OPENAI_ENDPOINT=https://<AOAI>.openai.azure.com" \
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large" \
  "AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini" \
  "AZURE_OPENAI_ANSWER_DEPLOYMENT=gpt-4o-mini" \
  "AZURE_CLIENT_ID_MI=<MI_CLIENT_ID>"

# 8. Assign RBAC: Search Index Data Reader on AI Search
az role assignment create \
  --assignee-object-id <MI_PRINCIPAL_ID> \
  --assignee-principal-type ServicePrincipal \
  --role "Search Index Data Reader" \
  --scope <SEARCH_RESOURCE_ID>

# 9. Register Azure Bot Service
az bot create \
  --resource-group <RG> \
  --name agent-aisearch-bot \
  --endpoint "https://<CONTAINER_APP_FQDN>/api/messages" \
  --app-type SingleTenant \
  --appid <APP_ID> \
  --tenant-id <TENANT_ID>

# 10. Enable Teams channel
az bot msteams create --resource-group <RG> --name agent-aisearch-bot

# 11. Sideload appPackage.zip to Teams
# Manual: Teams → Apps → Manage your apps → Upload a custom app
```

### Common Pitfalls
| Issue | Error | Fix |
|---|---|---|
| Missing service principal | `AADSTS7000229: missing service principal` | `az ad sp create --id <APP_ID>` |
| Wrong auth config | `Signing Key could not be retrieved` | Use `ConfigurationServiceClientCredentialFactory` as 2nd arg to `ConfigurationBotFrameworkAuthentication` |
| Password with special chars | `Authorization denied` on outbound | Ensure `~` and other special chars aren't mangled in env vars |
| Missing MI on Container App | `ManagedIdentityCredential: Network unreachable` | `az containerapp identity assign` with user-assigned MI |
| Missing RBAC on AI Search | `403 Forbidden` on search | Assign `Search Index Data Reader` role to MI on the search service |
| Wrong embedding dimensions | `vector dimension mismatch` | Match `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` to index vector field dimensions |
| Wrong deployment name | `404` on chat/embedding API | Verify deployment names exist: `az cognitiveservices account deployment list` |
| AI Search IP firewall | `403` or timeout | Add Container App outbound IPs or route through NAT Gateway |

### Manifest Requirements for M365 Copilot
- Manifest version: **1.22+**
- Add `copilotAgents.customEngineAgents` section alongside `bots`
- Bot ID in `copilotAgents.customEngineAgents[0].id` must match `bots[0].botId`
- `commandLists` entries become conversation starters in Copilot UI

## Key Decisions
- **Framework**: Teams SDK (teamsai v2) — TypeScript, matches coffee-agent sample
- **Search**: Direct Azure AI Search SDK — hybrid + semantic + query rewriting (reused from mcp-aisearch)
- **Hosting**: Container App in same VNet → same NAT GW IP → already whitelisted in AI Search
- **Auth for search**: Managed Identity (same as MCP server) — no OBO for this comparison
- **Manifest**: v1.22 with copilotAgents.customEngineAgents for M365 Copilot publishing
