import { App } from "@microsoft/teams.apps";
import { SearchService } from "./search-service";
import { buildSearchResultsCard, buildTextResponse } from "./cards";

const CONNECTION_NAME = process.env.OAUTH_CONNECTION_NAME || "AISearchSSO";

const app = new App({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  tenantId: process.env.TENANT_ID,
  oauth: {
    defaultConnectionName: CONNECTION_NAME,
  },
});

const searchService = new SearchService();

// Conversation history per conversation (session memory)
const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();

function getHistory(conversationId: string) {
  if (!conversationHistory.has(conversationId)) {
    conversationHistory.set(conversationId, []);
  }
  return conversationHistory.get(conversationId)!;
}

// Welcome message
app.on("install.add" as any, async ({ send }: any) => {
  await send(
    "👋 Hello! I'm the **Enterprise Document Search Agent**.\n\n" +
    "Ask me anything about your organization's documents — policies, guidelines, project documentation, and more.\n\n" +
    "I use advanced hybrid search with semantic reranking and AI-powered query rewriting for the best results.\n\n" +
    "🔐 Your search results are personalized — you'll only see documents you have access to."
  );
});

// Main message handler
app.on("message", async (ctx: any) => {
  const { send, activity, signin } = ctx;
  const query = activity.text?.trim();
  if (!query) {
    await send("Please enter a search query.");
    return;
  }

  const conversationId = activity.conversation?.id || "default";
  const history = getHistory(conversationId);

  // Step 1: Ensure user is signed in (SSO)
  const userToken = await signin();
  if (!userToken) {
    // SSO flow initiated — wait for signin event
    return;
  }

  // Step 2: Show typing indicator
  await send({ type: "typing" });

  try {
    // Step 3: Smart search with user's OBO token
    const results = await searchService.smartSearch(query, { top: 5 }, userToken);

    if (results.length === 0) {
      await send(
        "No relevant documents found. Try rephrasing your query or using different keywords."
      );
      history.push({ role: "user", content: query });
      history.push({ role: "assistant", content: "No results found." });
      return;
    }

    // Step 4: Generate RAG answer
    const answer = await searchService.generateAnswer(query, results);

    // Step 5: Send rich Adaptive Card with results
    const card = buildSearchResultsCard(query, answer, results);
    try {
      await send({
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card,
          },
        ],
      });
    } catch {
      // Fallback to text if Adaptive Card fails (e.g., some Copilot scenarios)
      await send(buildTextResponse(answer, results));
    }

    // Update conversation history
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: answer });

    // Trim history to last 10 exchanges
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  } catch (error: any) {
    console.error("Search error:", error);
    await send(
      `An error occurred while searching: ${error.message || "Unknown error"}. Please try again.`
    );
  }
});

// SSO success event
app.on("signin" as any, async ({ send }: any) => {
  await send("✅ Signed in successfully. Please send your question again.");
});

// Start the app
const port = process.env.PORT || 3978;
app.start(Number(port));
console.log(`Agent AI Search v2 listening on port ${port}`);
console.log(`OAuth connection: ${CONNECTION_NAME}`);
