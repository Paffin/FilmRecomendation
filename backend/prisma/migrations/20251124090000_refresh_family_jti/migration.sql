-- Add jti/family tracking and usage timestamps for refresh tokens

ALTER TABLE "RefreshToken"
  ADD COLUMN "jti" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "familyId" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RefreshToken" ALTER COLUMN "jti" DROP DEFAULT;
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" DROP DEFAULT;

CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");
