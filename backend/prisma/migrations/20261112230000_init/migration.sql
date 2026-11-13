-- CreateEnum
CREATE TYPE "ListingState" AS ENUM ('unknown', 'listed', 'unlisted');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('ok', 'not_found', 'error', 'timeout', 'partial');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('no_previous', 'no_material_change', 'pending', 'ready', 'llm_failed', 'llm_timeout', 'llm_unusable', 'llm_cap_reached', 'poll_failed');

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextPollAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMaterialAt" TIMESTAMP(3),
    "listingState" "ListingState" NOT NULL DEFAULT 'unknown',
    "title" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "priceAmount" DECIMAL(12,2),
    "priceCurrency" TEXT,
    "pricePeriod" TEXT,
    "priceDisplay" TEXT,
    "priceRaw" TEXT,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "pollStatus" "PollStatus" NOT NULL,
    "title" TEXT,
    "tagline" TEXT,
    "price" TEXT,
    "description" TEXT,
    "changed" BOOLEAN NOT NULL,
    "summary" TEXT,
    "summaryStatus" "SummaryStatus" NOT NULL,
    "summaryPrompt" TEXT,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmDailyUsage" (
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LlmDailyUsage_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "Competitor_nextPollAt_idx" ON "Competitor"("nextPollAt");

-- CreateIndex
CREATE INDEX "Snapshot_competitorId_fetchedAt_idx" ON "Snapshot"("competitorId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "Snapshot_fetchedAt_idx" ON "Snapshot"("fetchedAt");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
