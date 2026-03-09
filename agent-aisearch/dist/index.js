"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teams_apps_1 = require("@microsoft/teams.apps");
const search_service_1 = require("./search-service");
const cards_1 = require("./cards");
const CONNECTION_NAME = process.env.OAUTH_CONNECTION_NAME || "AISearchSSO";
const app = new teams_apps_1.App({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID,
    oauth: {
        defaultConnectionName: CONNECTION_NAME,
    },
});
const searchService = new search_service_1.SearchService();
// Conversation history per conversation (session memory)
const conversationHistory = new Map();
function getHistory(conversationId) {
    if (!conversationHistory.has(conversationId)) {
        conversationHistory.set(conversationId, []);
    }
    return conversationHistory.get(conversationId);
}
// Welcome message
app.on("install.add", async ({ send }) => {
    await send("👋 Hello! I'm the **Enterprise Document Search Agent**.\n\n" +
        "Ask me anything about your organization's documents — policies, guidelines, project documentation, and more.\n\n" +
        "I use advanced hybrid search with semantic reranking and AI-powered query rewriting for the best results.\n\n" +
        "🔐 Your search results are personalized — you'll only see documents you have access to.");
});
// Main message handler
app.on("message", async (ctx) => {
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
        // Step 3: Smart search with user's OBO token + conversation history
        const results = await searchService.smartSearch(query, { top: 5 }, userToken, history);
        if (results.length === 0) {
            await send("No relevant documents found. Try rephrasing your query or using different keywords.");
            history.push({ role: "user", content: query });
            history.push({ role: "assistant", content: "No results found." });
            return;
        }
        // Step 4: Generate RAG answer with conversation context
        const answer = await searchService.generateAnswer(query, results, history);
        // Step 5: Send rich Adaptive Card with results
        const card = (0, cards_1.buildSearchResultsCard)(query, answer, results);
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
        }
        catch {
            // Fallback to text if Adaptive Card fails (e.g., some Copilot scenarios)
            await send((0, cards_1.buildTextResponse)(answer, results));
        }
        // Update conversation history
        history.push({ role: "user", content: query });
        history.push({ role: "assistant", content: answer });
        // Trim history to last 10 exchanges
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
    }
    catch (error) {
        console.error("Search error:", error);
        await send(`An error occurred while searching: ${error.message || "Unknown error"}. Please try again.`);
    }
});
// SSO success event
app.on("signin", async ({ send }) => {
    await send("✅ Signed in successfully. Please send your question again.");
});
// Start the app
const port = process.env.PORT || 3978;
app.start(Number(port));
console.log(`Agent AI Search v2 listening on port ${port}`);
console.log(`OAuth connection: ${CONNECTION_NAME}`);
//# sourceMappingURL=index.js.map