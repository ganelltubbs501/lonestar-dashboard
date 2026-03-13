-- CreateTable
CREATE TABLE "BookScrapeRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "sitesChecked" INTEGER NOT NULL DEFAULT 0,
    "resultsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "BookScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookScrapeResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "authorName" TEXT,
    "bookTitle" TEXT,
    "contactInfo" TEXT,
    "releaseDate" TEXT,
    "texasConnection" TEXT NOT NULL,
    "snippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookScrapeResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookScrapeResult_runId_idx" ON "BookScrapeResult"("runId");

-- AddForeignKey
ALTER TABLE "BookScrapeResult" ADD CONSTRAINT "BookScrapeResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BookScrapeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
