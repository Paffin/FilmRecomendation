-- CreateEnum
CREATE TYPE "CatalogSnapshotKind" AS ENUM ('trending', 'popular');

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- CreateTable
CREATE TABLE "CatalogSnapshot" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "kind" "CatalogSnapshotKind" NOT NULL,
    "score" DOUBLE PRECISION,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogSnapshot_kind_snapshotDate_idx" ON "CatalogSnapshot"("kind", "snapshotDate");

-- CreateIndex
CREATE INDEX "CatalogSnapshot_mediaType_kind_snapshotDate_idx" ON "CatalogSnapshot"("mediaType", "kind", "snapshotDate");

-- CreateIndex
CREATE INDEX "CatalogSnapshot_tmdbId_mediaType_idx" ON "CatalogSnapshot"("tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
