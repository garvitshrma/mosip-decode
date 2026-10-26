ALTER TABLE "Run" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'workflow';
ALTER TABLE "Run" ADD COLUMN "verificationEvidence" TEXT;
