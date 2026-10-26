-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issuer" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verificationResult" TEXT,
    "errorStep" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "fromParty" TEXT NOT NULL,
    "toParty" TEXT NOT NULL,
    "requestJson" TEXT NOT NULL,
    "responseJson" TEXT,
    "httpStatus" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "credentialJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Credential_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");

-- CreateIndex
CREATE INDEX "Step_runId_idx" ON "Step"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_runId_key" ON "Credential"("runId");
