-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP', 'BROADCAST');

-- AlterTable
ALTER TABLE "conversations"
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "title" TEXT,
ALTER COLUMN "userAId" DROP NOT NULL,
ALTER COLUMN "userBId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_broadcast_targets" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_broadcast_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_kind_idx" ON "conversations"("kind");

-- CreateIndex
CREATE INDEX "conversations_createdById_idx" ON "conversations"("createdById");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "conversation_broadcast_targets_userId_idx" ON "conversation_broadcast_targets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_broadcast_targets_conversationId_userId_key" ON "conversation_broadcast_targets"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_targets" ADD CONSTRAINT "conversation_broadcast_targets_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_targets" ADD CONSTRAINT "conversation_broadcast_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed existing direct conversations into participant memberships
INSERT INTO "conversation_participants" ("id", "conversationId", "userId", "addedById")
SELECT 'legacy-' || "id" || '-a', "id", "userAId", "userAId"
FROM "conversations"
WHERE "userAId" IS NOT NULL
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "conversation_participants" ("id", "conversationId", "userId", "addedById")
SELECT 'legacy-' || "id" || '-b', "id", "userBId", "userAId"
FROM "conversations"
WHERE "userBId" IS NOT NULL
ON CONFLICT ("conversationId", "userId") DO NOTHING;
