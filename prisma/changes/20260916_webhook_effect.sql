-- Additive schema change for installations without Prisma migration history.
-- Apply before deploying the webhook replay protection.
CREATE TABLE IF NOT EXISTS "WebhookEffect" (
    "key" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEffect_pkey" PRIMARY KEY ("key")
);
