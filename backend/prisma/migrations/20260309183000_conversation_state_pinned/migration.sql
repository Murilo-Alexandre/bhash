-- AlterTable
ALTER TABLE "conversation_user_states"
ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "conversation_user_states_userId_pinned_idx"
ON "conversation_user_states"("userId", "pinned");
