# SharePoint Knowledge Source Pipeline — Findings Summary

> **Date**: March 2026  
> **Purpose**: Document findings from evaluating Azure AI Search Knowledge Source (KS) pipeline for SharePoint Online indexing, including comparison with a custom ingestion pipeline. Intended for AI consumption and incorporation into a larger comparison document.

---

## 1. Environment & Setup

| Component | Details |
|---|---|
| **Azure AI Search** | `search-advancedrag-test`, Standard tier, Sweden Central, system-assigned managed identity |
| **Azure OpenAI** | `openai-advancedrag-test`, Sweden Central. Key auth **disabled by Azure Policy** (`disableLocalAuth=true`) |
| **AI Services** | `ost-foudry` (kind: AIServices, S0), Sweden Central. Key auth **disabled**. Used for Content Understanding (standard extraction) |
| **SharePoint Source** | Site: `mngenvmcap445001.sharepoint.com/sites/Contoso`, Library: `Metodiky`, 100 `.docx` documents |
| **Authentication** | Managed identity only (RBAC). Search MI has `Cognitive Services OpenAI Contributor` on OpenAI, `Cognitive Services User` on AI Services |
| **API Version** | `2025-11-01-preview` |

### Deployed Models

| Model | Deployment Name | SKU |
|---|---|---|
| gpt-4o (2024-11-20) | `gpt-4o` | GlobalStandard/100 |
| text-embedding-3-large (v1) | `text-embedding-3-large` | GlobalStandard/150 |
| text-embedding-ada-002 (v2) | `text-embedding-ada-002` | GlobalStandard/150 |

---

## 2. Knowledge Source Configuration

- **Knowledge Source Name**: `spo-contoso-metodiky-ks`
- **Knowledge Base Name**: `spo-metodiky-kb`
- **Extraction Mode**: Standard (via Content Understanding / AI Services)
- **Embedding Model**: `text-embedding-3-large`
- **Chat Model**: `gpt-4o`
- **AI Services Endpoint**: `https://ost-foudry.cognitiveservices.azure.com/`

### Auto-Generated Azure AI Search Objects

The Knowledge Source API automatically creates and manages:

| Object | Name |
|---|---|
| Data Source | `spo-contoso-metodiky-ks-datasource` |
| Indexer | `spo-contoso-metodiky-ks-indexer` |
| Skillset | `spo-contoso-metodiky-ks-skillset` |
| Index | `spo-contoso-metodiky-ks-index` |

> **Important**: These objects are managed by the Knowledge Source API. Direct modifications are discouraged and may be overwritten.

---

## 3. Indexing Results

| Metric | Value |
|---|---|
| Documents Processed | 100 |
| Documents Failed | 0 |
| Total Chunks in Index | 278 |
| Text Chunks | 278 |
| **Image Chunks** | **0** |
| Indexer Duration | ~31 seconds |
| Errors | 0 |
| Warnings | 0 |

---

## 4. Image Indexing Issue — Diagnosis

### Problem

Despite the skillset containing a full image processing pipeline, **zero image chunks** were produced. The documents are known to contain images (headings like "Grafické shrnutí" / "Graphical summary" appear in 26 text chunks but no image content follows).

### Skillset Image Pipeline (Present but Non-functional)

The auto-generated skillset includes four skills in the correct order:

1. **ContentUnderstandingSkill** — `extractionOptions: ["images", "locationMetadata"]` configured
2. **AzureOpenAIEmbeddingSkill** — Text embedding with `text-embedding-3-large`
3. **GenAISkill (ChatCompletionSkill)** — gpt-4o for image verbalization (describing images as text)
4. **VerbalizedImageAzureOpenAIEmbeddingSkill** — Embedding the verbalized image descriptions

Index projections include both `snippet_parent_id` (text) and `image_snippet_parent_id` (image) selectors.

### Root Cause Analysis

| Finding | Detail |
|---|---|
| **Indexer config missing `imageAction`** | The indexer has `dataToExtract: contentAndMetadata` and `allowSkillsetToReadFileData: true`, but **no `imageAction` parameter** (e.g., `generateNormalizedImages`) is set |
| **Processing time too fast** | 31 seconds for 100 documents is incompatible with gpt-4o image verbalization, confirming images were never extracted |
| **No errors or warnings** | The indexer silently skips image extraction without reporting failures |
| **Content Understanding endpoint accessible** | CU API returns 401 (auth required), not 404, confirming availability |
| **RBAC may be insufficient** | Search MI has `Cognitive Services User` on `ost-foudry`; may need `Cognitive Services Contributor` for CU image extraction |

### Possible Causes (Ranked by Likelihood)

1. Missing `imageAction` indexer configuration — images never extracted from documents
2. Content Understanding image extraction limitation with `.docx` embedded images
3. SharePoint data source not passing full binary image data to the pipeline
4. RBAC role insufficient for Content Understanding image operations

### Impact

Image-heavy documents (diagrams, charts, graphical summaries) have their visual content completely missing from the search index. Only text content is searchable and retrievable.

---

## 5. Knowledge Source Pipeline Capabilities & Limitations

### What the Knowledge Source API Provides

| Capability | Status | Notes |
|---|---|---|
| Automated pipeline creation | ✅ | Single API call creates datasource, indexer, skillset, index |
| SharePoint Online connector | ✅ | Native SPO support with App Registration auth |
| Text chunking | ✅ | Automatic via Content Understanding |
| Text embedding | ✅ | Configurable model (used text-embedding-3-large) |
| Image extraction pipeline | ⚠️ | Pipeline is generated but **not functional** (0 image chunks) |
| Image verbalization (gpt-4o) | ⚠️ | Skill present but never triggered |
| Standard extraction (AI Services) | ✅ | Uses Content Understanding for higher-quality extraction |
| Managed identity auth | ✅ | Works without API keys |
| Incremental indexing | ✅ | Supports change detection |
| Knowledge Base for Foundry IQ | ✅ | Enables agentic retrieval in Azure AI Foundry |
| Semantic ranking | ❓ | Not explicitly configured in KS pipeline |

### What the Knowledge Source API Does NOT Provide

| Limitation | Detail |
|---|---|
| **Custom index schema** | Fixed schema, cannot add custom fields (e.g., category, author, metadata) |
| **Custom chunking strategy** | No control over chunk size, overlap, or section-aware splitting |
| **Scoring profiles** | Cannot define custom relevance boosting |
| **Synonym maps** | Not configurable |
| **Table extraction** | No specialized table handling (Markdown tables, structured data) |
| **Per-user security filtering** | No OBO (On-Behalf-Of) flow or per-document ACL filtering |
| **Custom skills** | Cannot add custom Web API skills or Azure Function skills |
| **Indexer schedule control** | Limited control over scheduling and retry policies |
| **Direct index modifications** | Auto-generated objects may be overwritten by the KS API |
| **Multi-source indexing** | Each KS targets one data source; cannot merge multiple sources into one index |

---

## 6. Comparison: Knowledge Source vs. Custom Pipeline (ostefka/mcp-aisearch)

### Architecture Overview

| Aspect | Knowledge Source Pipeline | Custom Pipeline (mcp-aisearch v16) |
|---|---|---|
| **Setup Effort** | Single REST API call | Full infrastructure: Blob Storage, AI Search, Document Intelligence, Container App, APIM, NAT Gateway |
| **Data Source** | SharePoint Online (native connector) | Azure Blob Storage (documents uploaded separately) |
| **Document Cracking** | Content Understanding (AI Services) | Document Intelligence Layout API |
| **Chunking** | Automatic (CU-managed, no config) | Section-aware by heading (h3), configurable size/overlap |
| **Embedding Model** | Configurable (text-embedding-3-large) | text-embedding-3-large (3072 dimensions) |
| **Index Schema** | Fixed (~auto-generated fields) | Custom 18-field schema with metadata, categories, sections |
| **Table Handling** | Basic text extraction | Markdown table preservation via DI Layout |
| **Image Handling** | Pipeline present but non-functional | OCR via DI; complex diagrams planned (gpt-4o vision) |
| **Search Modes** | Basic vector/hybrid via Foundry IQ | 3 modes: vector, hybrid, semantic + query rewriting (gpt-4o-mini) |
| **Scoring/Ranking** | Default | Custom scoring profiles, synonym maps, semantic config |
| **Security** | App Registration (SPO access) | 6-layer: JWT, OBO, per-document ACL, APIM policies, NAT Gateway, RBAC |
| **Retrieval Interface** | Foundry IQ / Knowledge Base API | MCP Server (5 tools) for AI agent integration |
| **Maintenance** | Fully managed | Self-managed (infrastructure, code, updates) |

### Quality Comparison

| Quality Dimension | Knowledge Source | Custom Pipeline |
|---|---|---|
| **Text Retrieval** | Good (standard extraction + embedding-3-large) | Excellent (DI Layout + section-aware chunking + scoring profiles + synonym maps) |
| **Image Retrieval** | Non-functional (0 image chunks) | Partial (OCR text from DI; gpt-4o vision planned) |
| **Table Retrieval** | Basic (plain text) | Good (Markdown tables preserved) |
| **Metadata Filtering** | None | Rich (category, section, document type, date ranges) |
| **Relevance Tuning** | Not configurable | Fully tunable (scoring profiles, boosting, synonyms) |
| **Security Filtering** | None (all-or-nothing access) | Per-user document-level ACLs |
| **Chunk Context** | Opaque | Section hierarchy preserved (parent headings, document structure) |

### Cost & Complexity

| Factor | Knowledge Source | Custom Pipeline |
|---|---|---|
| **Azure services required** | AI Search + OpenAI + AI Services | AI Search + OpenAI + Document Intelligence + Blob Storage + Container App + APIM + NAT Gateway |
| **Development time** | Minutes (single API call) | Weeks to months |
| **Ongoing maintenance** | Near-zero | Significant (code updates, infra management, security patches) |
| **Flexibility** | Low (black-box pipeline) | Full control |
| **Scalability** | Managed by Azure | Self-managed scaling |

---

## 7. Key API Findings

### Authentication

- Azure Policy can enforce `disableLocalAuth=true` on OpenAI and AI Services resources
- When key auth is disabled, omit `apiKey` fields entirely from KS creation payload
- Search service managed identity + RBAC roles replace API key auth

### API Schema Notes

- The `aiServices` property in KS creation uses `uri` (not `endpoint`): `{ "uri": "https://...", "apiKey": "..." }`
- Knowledge Base creation requires a separate API call after KS creation
- KS type for SharePoint: `kind: "storage"` with `storageKind: "sharePointOnline"`

### Managed Identity Role Requirements

| Role | Target Resource | Purpose |
|---|---|---|
| `Cognitive Services OpenAI Contributor` | OpenAI resource | Embedding and chat completions |
| `Cognitive Services User` | AI Services resource | Content Understanding (standard extraction) |

---

## 8. Recommendations

### For Quick Prototyping / Low-Complexity Scenarios

Use Knowledge Source pipeline when:
- Text-only documents (no critical image content)
- No per-user security requirements
- Default relevance ranking is acceptable
- Fast time-to-value is priority
- Integration with Foundry IQ / agentic retrieval is desired

### For Production / High-Quality Scenarios

Use custom pipeline when:
- Documents contain important images, diagrams, or tables
- Per-user/per-document security filtering is required
- Custom relevance tuning (scoring profiles, synonyms) is needed
- Rich metadata extraction and filtering is required
- Section-aware chunking improves retrieval quality
- Full control over index schema and search behavior is necessary

### Hybrid Approach (Recommended)

Combine both approaches:
1. Build a **custom ingestion pipeline** for full control over document processing, chunking, and index schema
2. Create a **`searchIndex` kind Knowledge Source** pointing at the custom index
3. This enables **Foundry IQ agentic retrieval** on top of a high-quality custom index
4. Best of both worlds: custom pipeline quality + managed retrieval experience

> **Note**: The `searchIndex` knowledge source type connects to an existing Azure AI Search index without creating its own pipeline, making it compatible with any custom index.
