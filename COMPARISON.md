# Enterprise AI Search Agents — Comparison Matrix

> **Scenario:** 1,000 M365 users · 250 with M365 Copilot license ($30/user/month) · Enterprise org  
> **Goal:** Compare Microsoft ecosystem agents for semantic search over enterprise documents (policies, guidelines, project docs)  
> **Date:** March 2026

---

## Agent Types at a Glance

| # | Agent Type | Platform | Data Source | Code Required |
|---|-----------|----------|-------------|---------------|
| 1 | **Agent Builder (SPO)** | M365 Copilot | SharePoint Online | None |
| 2 | **Copilot Studio (SPO)** | Copilot Studio | SharePoint Online | None |
| 3 | **Copilot Studio (SPO + Dataverse OOTB)** | Copilot Studio | SPO → Dataverse (OOTB sync) | None |
| 4 | **Copilot Studio (SPO + Dataverse Custom)** | Copilot Studio | SPO → Dataverse (custom pipeline) | Low-code / Power Automate |
| 5 | **Declarative Agent + AI Search** | M365 Copilot | Azure AI Search index | Pro-code (TypeScript) |
| 6 | **Copilot Studio + MCP → AI Search** | Copilot Studio | Azure AI Search via MCP server | Pro-code (TypeScript) |
| 7 | **Azure AI Foundry Agent** | Azure AI Foundry | Azure AI Search / Foundry file search | Low-code + config |
| 8 | **M365 Agents SDK (Custom Engine)** | Azure (self-hosted) | Azure AI Search (direct) | Pro-code (TypeScript/C#) |

---

## Architecture Diagrams

### 1 — Agent Builder (SPO)

```mermaid
flowchart LR
    U[User] -->|M365 Copilot| AB[Agent Builder]
    AB -->|M365 Index| SPO[(SharePoint Online)]
    style AB fill:#0078d4,color:#fff
    style SPO fill:#036,color:#fff
```

**How it works:** Zero-config agent created in M365 Copilot. Points at SPO sites/libraries. Uses Microsoft's built-in M365 index (same index Copilot uses). No external infrastructure.

---

### 2 — Copilot Studio Agent (SPO)

```mermaid
flowchart LR
    U[User] -->|Teams / Web| CS[Copilot Studio]
    CS -->|SPO Connector| SPO[(SharePoint Online)]
    CS -->|Built-in AI| LLM[Azure OpenAI]
    style CS fill:#742774,color:#fff
    style SPO fill:#036,color:#fff
```

**How it works:** Copilot Studio agent with SharePoint knowledge source. Uses SPO connector to retrieve documents. Built-in generative answers with RAG. Topics and conversation flow can be customized.

---

### 3 — Copilot Studio + Dataverse (OOTB Sync)

```mermaid
flowchart LR
    U[User] -->|Teams / Web| CS[Copilot Studio]
    SPO[(SharePoint Online)] -->|OOTB Sync| DV[(Dataverse)]
    CS -->|Knowledge Source| DV
    CS -->|Built-in AI| LLM[Azure OpenAI]
    style CS fill:#742774,color:#fff
    style SPO fill:#036,color:#fff
    style DV fill:#107c10,color:#fff
```

**How it works:** SPO content is synced to Dataverse using out-of-the-box Knowledge Management sync. Copilot Studio searches Dataverse knowledge articles. More structured data model than raw SPO.

---

### 4 — Copilot Studio + Dataverse (Custom Sync)

```mermaid
flowchart LR
    U[User] -->|Teams / Web| CS[Copilot Studio]
    SPO[(SharePoint Online)] -->|Power Automate / Azure Function| PA[Custom Pipeline]
    PA -->|Chunking + Metadata| DV[(Dataverse)]
    CS -->|Knowledge Source| DV
    CS -->|Built-in AI| LLM[Azure OpenAI]
    style CS fill:#742774,color:#fff
    style SPO fill:#036,color:#fff
    style DV fill:#107c10,color:#fff
    style PA fill:#0066ff,color:#fff
```

**How it works:** Custom ingestion pipeline (Power Automate or Azure Function) extracts documents from SPO, chunks them, enriches metadata, and loads into Dataverse. Gives full control over chunking strategy and metadata. Higher setup effort, better searchability.

---

### 5 — Declarative Agent + AI Search

```mermaid
flowchart LR
    U[User] -->|M365 Copilot| DA[Declarative Agent]
    DA -->|API Plugin / OpenAPI| APIM[Azure APIM]
    APIM -->|OAuth + IP filter| MCP[MCP Server<br/>Container App]
    MCP -->|OBO Token| AIS[(Azure AI Search)]
    MCP -->|Embeddings + Rewriting| AOAI[Azure OpenAI]
    style DA fill:#0078d4,color:#fff
    style APIM fill:#ff8c00,color:#fff
    style MCP fill:#00bcf2,color:#fff
    style AIS fill:#e81123,color:#fff
    style AOAI fill:#68217a,color:#fff
```

**How it works:** M365 Copilot declarative agent calls an API plugin backed by the MCP server. The MCP server (Container App) does OBO token exchange, hybrid search (text + vector + semantic reranking), and query rewriting via Azure OpenAI. 6-layer security. Full control over search quality.

---

### 6 — Copilot Studio + MCP → AI Search

```mermaid
flowchart LR
    U[User] -->|Teams / Web| CS[Copilot Studio]
    CS -->|MCP Protocol| APIM[Azure APIM]
    APIM -->|OAuth + IP filter| MCP[MCP Server<br/>Container App]
    MCP -->|OBO Token| AIS[(Azure AI Search)]
    MCP -->|Embeddings + Rewriting| AOAI[Azure OpenAI]
    style CS fill:#742774,color:#fff
    style APIM fill:#ff8c00,color:#fff
    style MCP fill:#00bcf2,color:#fff
    style AIS fill:#e81123,color:#fff
    style AOAI fill:#68217a,color:#fff
```

**How it works:** Same Azure infrastructure as #5, but the front-end is Copilot Studio instead of a declarative agent. Copilot Studio natively connects to the MCP server. Benefits from Copilot Studio's conversation design + custom AI Search pipeline.

---

### 7 — Azure AI Foundry Agent

```mermaid
flowchart LR
    U[User] -->|API / Teams| FA[Foundry Agent]
    FA -->|Built-in Tool| AIS[(Azure AI Search)]
    FA -->|LLM| AOAI[Azure OpenAI]
    FA -->|Optional| FS[Foundry File Search]
    style FA fill:#0078d4,color:#fff
    style AIS fill:#e81123,color:#fff
    style AOAI fill:#68217a,color:#fff
    style FS fill:#999,color:#fff
```

**How it works:** Azure AI Foundry hosted agent with Azure AI Search as a tool. Foundry manages the LLM orchestration, grounding, and response generation. Can also use Foundry's built-in file search (creates its own vector store). Evaluation and monitoring built-in.

---

### 8 — M365 Agents SDK (Custom Engine)

```mermaid
flowchart LR
    U[User] -->|Teams / Custom UI| BOT[Custom Engine Agent<br/>Azure App Service]
    BOT -->|Direct API| AIS[(Azure AI Search)]
    BOT -->|LLM| AOAI[Azure OpenAI]
    BOT -->|Bot Framework| BF[Azure Bot Service]
    style BOT fill:#005a9e,color:#fff
    style AIS fill:#e81123,color:#fff
    style AOAI fill:#68217a,color:#fff
    style BF fill:#0078d4,color:#fff
```

**How it works:** Full-code agent built with M365 Agents SDK (TypeScript or C#). Deployed to Azure App Service or Container App. Direct integration with Azure AI Search and Azure OpenAI. Total control over every aspect: search, prompts, response formatting, conversation flow. Surfaces in Teams via Bot Framework.

---

## Comparison Matrix

### Setup Effort

| # | Agent | Initial Setup | Skills Required | Time to First Demo |
|---|-------|--------------|-----------------|-------------------|
| 1 | Agent Builder (SPO) | Point-and-click in M365 | None | **< 1 hour** |
| 2 | Copilot Studio (SPO) | Copilot Studio designer | Citizen developer | **< 1 day** |
| 3 | CS + Dataverse OOTB | Studio + enable sync | Citizen developer + admin | **1–2 days** |
| 4 | CS + Dataverse Custom | Studio + build pipeline | Power Platform + dev skills | **1–2 weeks** |
| 5 | Declarative Agent + AI Search | Azure infra + MCP server + agent manifest | Azure + TypeScript + Entra ID | **2–4 weeks** |
| 6 | CS + MCP → AI Search | Azure infra + MCP server + Studio config | Azure + TypeScript + Studio | **2–4 weeks** |
| 7 | Foundry Agent | Foundry project + index config | Azure + AI Foundry | **1–2 weeks** |
| 8 | M365 Agents SDK | Azure infra + bot registration + code | Azure + TypeScript/C# + Bot Framework | **3–5 weeks** |

---

### Maintenance Effort

| # | Agent | Infra to Maintain | Updates Required | Effort Level |
|---|-------|--------------------|-----------------|-------------|
| 1 | Agent Builder (SPO) | None (SaaS) | SPO permissions only | 🟢 **Minimal** |
| 2 | Copilot Studio (SPO) | None (SaaS) | Topic/flow updates | 🟢 **Minimal** |
| 3 | CS + Dataverse OOTB | Dataverse storage monitoring | Sync health checks | 🟡 **Low** |
| 4 | CS + Dataverse Custom | Pipeline + Dataverse | Pipeline failures, schema changes | 🟡 **Medium** |
| 5 | Declarative Agent + AI Search | Container App, APIM, AI Search, OpenAI, Key Vault, VNet | Image updates, cert rotation, index maintenance | 🔴 **High** |
| 6 | CS + MCP → AI Search | Container App, APIM, AI Search, OpenAI, Key Vault, VNet | Same as #5 + Studio flow updates | 🔴 **High** |
| 7 | Foundry Agent | Foundry project, AI Search, OpenAI | Model updates, index reindexing | 🟡 **Medium** |
| 8 | M365 Agents SDK | App Service, AI Search, OpenAI, Bot Service | Code deployments, dependency updates | 🔴 **High** |

---

### Output Quality

| # | Agent | Search Method | Semantic Understanding | Answer Quality | Citation Quality |
|---|-------|--------------|----------------------|---------------|-----------------|
| 1 | Agent Builder (SPO) | M365 Index (keyword + semantic) | Good (M365 built-in) | ⭐⭐⭐ Good | ⭐⭐⭐ Links to SPO |
| 2 | Copilot Studio (SPO) | SPO connector (keyword) | Basic | ⭐⭐ Acceptable | ⭐⭐ Links to SPO |
| 3 | CS + Dataverse OOTB | Dataverse search | Basic-to-Good | ⭐⭐ Acceptable | ⭐⭐ Dataverse refs |
| 4 | CS + Dataverse Custom | Dataverse search + custom metadata | Good (depends on pipeline) | ⭐⭐⭐ Good | ⭐⭐⭐ Custom metadata |
| 5 | Declarative Agent + AI Search | Hybrid (BM25 + vector + semantic reranking) + query rewriting | Excellent | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Rich metadata |
| 6 | CS + MCP → AI Search | Hybrid + query rewriting (same engine as #5) | Excellent | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Rich metadata |
| 7 | Foundry Agent | AI Search (configurable) + optional vector store | Very Good | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐ Configurable |
| 8 | M365 Agents SDK | AI Search (full control — any mode) | Excellent (custom) | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐⭐ Full control |

---

### Ingestion Capabilities

| # | Agent | Supported Sources | Chunking Control | Metadata Enrichment | Update Frequency |
|---|-------|------------------|-----------------|--------------------|-----------------  |
| 1 | Agent Builder (SPO) | SPO sites, libraries, pages | None (M365 index) | None | Automatic (M365 crawl) |
| 2 | Copilot Studio (SPO) | SPO sites, libraries | None | None | Automatic (SPO connector) |
| 3 | CS + Dataverse OOTB | SPO → Dataverse | Minimal (OOTB) | Basic (article schema) | Scheduled sync |
| 4 | CS + Dataverse Custom | Any (SPO, file shares, APIs, DBs) | Full control | Full control | Custom schedule |
| 5 | Declarative Agent + AI Search | Any (Doc Intelligence, custom indexers, push API) | Full control (chunk size, overlap, strategy) | Full control (custom fields, facets, scoring profiles) | Custom (indexer schedule or push) |
| 6 | CS + MCP → AI Search | Same as #5 | Same as #5 | Same as #5 | Same as #5 |
| 7 | Foundry Agent | Files (upload or blob), AI Search index, custom data | Configurable (Foundry file search or custom) | Moderate | On upload or indexer |
| 8 | M365 Agents SDK | Any (same flexibility as #5) | Full control | Full control | Custom |

---

## Pricing Comparison

> **Assumptions:**  
> - 1,000 M365 users, 250 with M365 Copilot license ($30/user/month)  
> - Copilot Studio messages included with Copilot license (10K messages/month/tenant baseline)  
> - Moderate usage: ~5,000 queries/month across all users  
> - Azure pricing: Sweden Central region, pay-as-you-go  
> - All prices are estimated monthly costs (USD)

### M365 / Power Platform Costs

| # | Agent | M365 Copilot Cost | Copilot Studio Cost | Power Platform / Dataverse | Subtotal (M365 side) |
|---|-------|-------------------|--------------------|--------------------------|--------------------|
| 1 | Agent Builder (SPO) | Included with Copilot license | — | — | **$0** (included) |
| 2 | Copilot Studio (SPO) | Included with Copilot license | Included (within message quota) | — | **$0** (included) |
| 3 | CS + Dataverse OOTB | Included | Included | Dataverse storage ~$40/GB/month | **~$40–120** |
| 4 | CS + Dataverse Custom | Included | Included | Dataverse + Power Automate premium ~$15/user/month or pay-per-flow | **~$100–500** |
| 5 | Declarative Agent + AI Search | Included with Copilot license | — | — | **$0** (included) |
| 6 | CS + MCP → AI Search | Included | Included (within message quota) | — | **$0** (included) |
| 7 | Foundry Agent | N/A (standalone) | — | — | **$0** |
| 8 | M365 Agents SDK | N/A (uses Bot Framework) | — | — | **$0** |

### Azure Costs

| # | Agent | AI Search | Azure OpenAI | Compute | Networking | Other | Subtotal (Azure) |
|---|-------|-----------|-------------|---------|------------|-------|-----------------|
| 1 | Agent Builder (SPO) | — | — | — | — | — | **$0** |
| 2 | Copilot Studio (SPO) | — | — | — | — | — | **$0** |
| 3 | CS + Dataverse OOTB | — | — | — | — | — | **$0** |
| 4 | CS + Dataverse Custom | — | — | Azure Functions (consumption) | — | — | **~$5–20** |
| 5 | Declarative Agent + AI Search | S1: ~$250 | ~$30–50 (embeddings + rewriting) | Container App: ~$50–100 | VNet + NAT GW: ~$40 | APIM Consumption: ~$10, Key Vault: ~$5 | **~$385–455** |
| 6 | CS + MCP → AI Search | S1: ~$250 | ~$30–50 | Container App: ~$50–100 | VNet + NAT GW: ~$40 | APIM: ~$10, KV: ~$5 | **~$385–455** |
| 7 | Foundry Agent | Basic: ~$75 or S1: ~$250 | ~$50–100 (GPT-4o + embeddings) | Foundry hosting: included | — | Foundry project: ~$0 (pay per use) | **~$125–350** |
| 8 | M365 Agents SDK | S1: ~$250 | ~$30–50 | App Service B1: ~$55 | — | Bot Service: free (standard) | **~$335–355** |

### Total Monthly Cost Summary

| # | Agent | M365 Cost | Azure Cost | **Total Monthly** | Annual |
|---|-------|-----------|------------|-------------------|--------|
| 1 | Agent Builder (SPO) | $0 | $0 | **$0** | **$0** |
| 2 | Copilot Studio (SPO) | $0 | $0 | **$0** | **$0** |
| 3 | CS + Dataverse OOTB | ~$80 | $0 | **~$80** | **~$960** |
| 4 | CS + Dataverse Custom | ~$300 | ~$10 | **~$310** | **~$3,720** |
| 5 | Declarative Agent + AI Search | $0 | ~$420 | **~$420** | **~$5,040** |
| 6 | CS + MCP → AI Search | $0 | ~$420 | **~$420** | **~$5,040** |
| 7 | Foundry Agent | $0 | ~$240 | **~$240** | **~$2,880** |
| 8 | M365 Agents SDK | $0 | ~$345 | **~$345** | **~$4,140** |

> **Note:** Agents #1, #2, #5, and #6 show $0 for M365 costs because they leverage the existing M365 Copilot license ($30/user/month × 250 users = $7,500/month already paid). The incremental cost of adding these agents is $0 on the M365 side.

---

## Scoring Matrix

> Scale: 1 (worst) → 5 (best) for each dimension

| # | Agent | Setup Effort | Maintenance | Output Quality | Ingestion Flexibility | Cost Efficiency | **Total /25** |
|---|-------|:----------:|:-----------:|:-------------:|:--------------------:|:--------------:|:--------:|
| 1 | Agent Builder (SPO) | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐ 3 | ⭐ 1 | ⭐⭐⭐⭐⭐ 5 | **19** |
| 2 | Copilot Studio (SPO) | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐ 2 | ⭐ 1 | ⭐⭐⭐⭐⭐ 5 | **18** |
| 3 | CS + Dataverse OOTB | ⭐⭐⭐⭐ 4 | ⭐⭐⭐⭐ 4 | ⭐⭐ 2 | ⭐⭐ 2 | ⭐⭐⭐⭐ 4 | **16** |
| 4 | CS + Dataverse Custom | ⭐⭐⭐ 3 | ⭐⭐⭐ 3 | ⭐⭐⭐ 3 | ⭐⭐⭐ 3 | ⭐⭐⭐ 3 | **15** |
| 5 | Declarative Agent + AI Search | ⭐⭐ 2 | ⭐⭐ 2 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐ 2 | **16** |
| 6 | CS + MCP → AI Search | ⭐⭐ 2 | ⭐⭐ 2 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐ 2 | **16** |
| 7 | Foundry Agent | ⭐⭐⭐ 3 | ⭐⭐⭐ 3 | ⭐⭐⭐⭐ 4 | ⭐⭐⭐⭐ 4 | ⭐⭐⭐ 3 | **17** |
| 8 | M365 Agents SDK | ⭐ 1 | ⭐ 1 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐⭐⭐⭐ 5 | ⭐⭐ 2 | **14** |

---

## Radar Chart Data

> For use in presentations — paste into any charting tool or render with Mermaid

```mermaid
%%{init: {'theme': 'default'}}%%
radar-beta
  axis Setup["Setup Effort"], Maint["Maintenance"], Quality["Output Quality"], Ingest["Ingestion"], Cost["Cost Efficiency"]
  "Agent Builder (SPO)" : [5, 5, 3, 1, 5]
  "Copilot Studio (SPO)" : [5, 5, 2, 1, 5]
  CS + Dataverse OOTB : [4, 4, 2, 2, 4]
  CS + Dataverse Custom : [3, 3, 3, 3, 3]
  Declarative + AI Search : [2, 2, 5, 5, 2]
  CS + MCP → AI Search : [2, 2, 5, 5, 2]
  Foundry Agent : [3, 3, 4, 4, 3]
  M365 Agents SDK : [1, 1, 5, 5, 2]
```

---

## Decision Framework

### When to use which agent

```mermaid
flowchart TD
    START{Need AI search<br/>over enterprise docs?} -->|Yes| Q1{Is SharePoint Online<br/>the only source?}
    Q1 -->|Yes| Q2{Need custom<br/>conversation flow?}
    Q2 -->|No| A1[✅ Agent Builder SPO<br/>Zero effort, free]
    Q2 -->|Yes| A2[✅ Copilot Studio SPO<br/>Easy setup, free]
    Q1 -->|No| Q3{Need maximum<br/>search quality?}
    Q3 -->|No| Q4{Budget for Azure infra?}
    Q4 -->|No| A3[✅ CS + Dataverse<br/>Low cost, acceptable quality]
    Q4 -->|Yes| A7[✅ Foundry Agent<br/>Good balance]
    Q3 -->|Yes| Q5{Need full code control<br/>over everything?}
    Q5 -->|No| Q6{Front-end preference?}
    Q6 -->|M365 Copilot| A5[✅ Declarative Agent + AI Search]
    Q6 -->|Copilot Studio| A6[✅ CS + MCP → AI Search]
    Q5 -->|Yes| A8[✅ M365 Agents SDK<br/>Maximum control]
```

---

## Key Takeaways

| Insight | Details |
|---------|---------|
| **Cheapest & fastest** | Agent Builder (#1) — zero cost, zero code, sub-1-hour setup |
| **Best search quality** | AI Search-backed agents (#5, #6, #8) — hybrid search + semantic reranking + query rewriting |
| **Best balance** | Foundry Agent (#7) — moderate cost, good quality, built-in evaluation and monitoring |
| **Sweet spot for Copilot orgs** | Agent Builder for quick wins → Declarative Agent + AI Search when quality matters |
| **#5 vs #6 are identical backend** | Same MCP server + AI Search infra, different front-end (M365 Copilot vs Copilot Studio) |
| **Dataverse path is a middle ground** | Better than raw SPO search, cheaper than AI Search, but limited ingestion |
| **Custom Engine Agent (#8)** | Maximum control but highest setup/maintenance — justified only when Teams-native UX customization is critical |

---

## Appendix: Pricing Assumptions

| Item | Price | Source |
|------|-------|--------|
| M365 Copilot license | $30/user/month | [Microsoft 365 pricing](https://www.microsoft.com/en-us/microsoft-365/copilot) |
| Azure AI Search S1 | ~$250/month | [AI Search pricing](https://azure.microsoft.com/en-us/pricing/details/search/) |
| Azure AI Search Basic | ~$75/month | Same |
| Azure OpenAI (text-embedding-3-large) | $0.00013/1K tokens | [Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) |
| Azure OpenAI (GPT-4o-mini) | $0.15/1M input tokens | Same |
| Azure Container Apps (Consumption) | ~$50–100/month (moderate traffic) | [Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/) |
| Azure App Service B1 | ~$55/month | [App Service pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/) |
| APIM Consumption | ~$3.50/million calls | [APIM pricing](https://azure.microsoft.com/en-us/pricing/details/api-management/) |
| NAT Gateway | ~$32/month + data | [NAT Gateway pricing](https://azure.microsoft.com/en-us/pricing/details/azure-nat-gateway/) |
| Dataverse storage | ~$40/GB/month (database) | [Power Platform pricing](https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing) |
| Copilot Studio messages | Included with M365 Copilot (baseline quota) | [Copilot Studio licensing](https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing) |

> ⚠️ **Prices are estimates as of March 2026.** Always verify with the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) before making decisions.
