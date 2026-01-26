-- CreateTable
CREATE TABLE "MicrosoftAccount" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "microsoftEmail" TEXT NOT NULL,
    "microsoftDisplayName" TEXT,
    "microsoftTenantId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftAccount_ownerId_key" ON "MicrosoftAccount"("ownerId");

-- CreateIndex
CREATE INDEX "MicrosoftAccount_ownerId_idx" ON "MicrosoftAccount"("ownerId");

-- CreateIndex
CREATE INDEX "MicrosoftAccount_microsoftEmail_idx" ON "MicrosoftAccount"("microsoftEmail");

-- AddForeignKey
ALTER TABLE "MicrosoftAccount" ADD CONSTRAINT "MicrosoftAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
