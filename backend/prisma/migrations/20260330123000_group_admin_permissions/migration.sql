-- AlterTable
ALTER TABLE "conversation_participants"
ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "conversation_participants_conversationId_isAdmin_idx"
ON "conversation_participants"("conversationId", "isAdmin");
