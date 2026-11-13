import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { createCompetitorRepository } from "./modules/competitors/competitors.repository";
import { createCompetitorService } from "./modules/competitors/competitors.service";
import { createPollingRepository } from "./modules/polling/polling.repository";
import { createPollingService } from "./modules/polling/polling.service";
import { createTokenBucket } from "./modules/polling/token-bucket";
import { loadConfig } from "./shared/config";
import { createListingClient } from "./integrations/listing-client";
import { createLlmClient } from "./integrations/llm-client";
import { logger } from "./shared/logger";

const config = loadConfig();
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const competitorRepository = createCompetitorRepository(prisma);
const pollingRepository = createPollingRepository(prisma);
const competitorService = createCompetitorService(competitorRepository);
const listing = createListingClient({
  baseUrl: config.listingSourceBaseUrl,
  timeoutMs: config.sourceTimeoutMs,
});
const llm = createLlmClient({
  baseUrl: config.llmBaseUrl,
  apiKey: config.llmApiKey,
  model: config.llmModel,
  timeoutMs: config.llmTimeoutMs,
});
const bucket = createTokenBucket(config.sourceRatePerSecond);
const pollingService = createPollingService({
  repository: pollingRepository,
  listing,
  llm,
  bucket,
  pollIntervalMs: config.pollIntervalMs,
  llmDailyCap: config.llmDailyCap,
  retentionDays: config.retentionDays,
  logger,
});

const app = createApp(competitorService);

app.listen(config.port, () => {
  logger.info({ port: config.port }, "api listening");
  pollingService.start();
});
