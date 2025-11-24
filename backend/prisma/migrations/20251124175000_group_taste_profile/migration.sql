-- Create GroupTasteProfile for group/company taste memory

CREATE TABLE "GroupTasteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTasteProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupTasteProfile_userId_companyType_key"
  ON "GroupTasteProfile"("userId", "companyType");

CREATE INDEX "GroupTasteProfile_userId_idx"
  ON "GroupTasteProfile"("userId");

ALTER TABLE "GroupTasteProfile"
  ADD CONSTRAINT "GroupTasteProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

