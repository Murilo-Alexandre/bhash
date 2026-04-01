-- CreateEnum
CREATE TYPE "GroupDepartureReason" AS ENUM ('LEFT', 'REMOVED', 'GROUP_DELETED');

-- AlterTable
ALTER TABLE "conversation_user_states"
ADD COLUMN "leftReason" "GroupDepartureReason";
