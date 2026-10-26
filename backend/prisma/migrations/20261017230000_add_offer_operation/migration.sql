-- CreateTable
CREATE TABLE "OfferOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "credentialConfigurationId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "offerUri" TEXT,
    "issuerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfferOperation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferOperation_runId_key" ON "OfferOperation"("runId");

-- CreateIndex
CREATE INDEX "OfferOperation_status_idx" ON "OfferOperation"("status");
