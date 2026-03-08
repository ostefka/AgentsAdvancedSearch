"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const botbuilder_1 = require("botbuilder");
const bot_1 = require("./bot");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Bot Framework auth configuration for SingleTenant
const credentialFactory = new botbuilder_1.ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.BOT_ID || "",
    MicrosoftAppPassword: process.env.BOT_PASSWORD || "",
    MicrosoftAppType: "SingleTenant",
    MicrosoftAppTenantId: process.env.BOT_TENANT_ID || "",
});
const botFrameworkAuth = new botbuilder_1.ConfigurationBotFrameworkAuthentication({}, credentialFactory);
const adapter = new botbuilder_1.CloudAdapter(botFrameworkAuth);
// Error handler
adapter.onTurnError = async (context, error) => {
    console.error(`[onTurnError] ${error.message}`, error);
    await context.sendActivity("Sorry, an error occurred. Please try again.");
};
const bot = new bot_1.SearchAgentBot();
// Bot messages endpoint
app.post("/api/messages", async (req, res) => {
    await adapter.process(req, res, (context) => bot.run(context));
});
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", agent: "agent-aisearch", timestamp: new Date().toISOString() });
});
const port = process.env.PORT || 3978;
app.listen(port, () => {
    console.log(`Agent AI Search bot listening on port ${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`Messages: POST http://localhost:${port}/api/messages`);
});
//# sourceMappingURL=index.js.map