-- CreateTable
CREATE TABLE "RecommendationExperiment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExperimentAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sticky" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleEmbedding" (
    "titleId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "model" TEXT NOT NULL,
    "language" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleEmbedding_pkey" PRIMARY KEY ("titleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationExperiment_key_key" ON "RecommendationExperiment"("key");

-- CreateIndex
CREATE INDEX "UserExperimentAssignment_experimentId_idx" ON "UserExperimentAssignment"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserExperimentAssignment_userId_experimentId_key" ON "UserExperimentAssignment"("userId", "experimentId");

-- AddForeignKey
ALTER TABLE "UserExperimentAssignment" ADD CONSTRAINT "UserExperimentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExperimentAssignment" ADD CONSTRAINT "UserExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "RecommendationExperiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleEmbedding" ADD CONSTRAINT "TitleEmbedding_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
