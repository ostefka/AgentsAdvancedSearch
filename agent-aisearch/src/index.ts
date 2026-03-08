import express from "express";
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
} from "botbuilder";
import { SearchAgentBot } from "./bot";

const app = express();
app.use(express.json());

// Bot Framework auth configuration for SingleTenant
const credentialFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.BOT_ID || "",
  MicrosoftAppPassword: process.env.BOT_PASSWORD || "",
  MicrosoftAppType: "SingleTenant",
  MicrosoftAppTenantId: process.env.BOT_TENANT_ID || "",
});

const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication(
  {},
  credentialFactory
);

const adapter = new CloudAdapter(botFrameworkAuth);

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error(`[onTurnError] ${error.message}`, error);
  await context.sendActivity("Sorry, an error occurred. Please try again.");
};

const bot = new SearchAgentBot();

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
