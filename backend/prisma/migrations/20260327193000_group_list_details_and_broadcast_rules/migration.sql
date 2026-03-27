-- AlterTable
ALTER TABLE "conversations"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "broadcastIncludeAllUsers" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "conversation_user_states"
ADD COLUMN "leftAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages"
ADD COLUMN "broadcastListId" TEXT,
ADD COLUMN "broadcastListTitle" TEXT;

-- CreateTable
CREATE TABLE "conversation_broadcast_companies" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_broadcast_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_broadcast_departments" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_broadcast_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_broadcast_excluded_users" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_broadcast_excluded_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_broadcastListId_idx" ON "messages"("broadcastListId");

-- CreateIndex
CREATE INDEX "conversation_user_states_userId_leftAt_idx" ON "conversation_user_states"("userId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_broadcast_companies_conversationId_companyId_key" ON "conversation_broadcast_companies"("conversationId", "companyId");

-- CreateIndex
CREATE INDEX "conversation_broadcast_companies_companyId_idx" ON "conversation_broadcast_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_broadcast_departments_conversationId_departmentId_key" ON "conversation_broadcast_departments"("conversationId", "departmentId");

-- CreateIndex
CREATE INDEX "conversation_broadcast_departments_departmentId_idx" ON "conversation_broadcast_departments"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_broadcast_excluded_users_conversationId_userId_key" ON "conversation_broadcast_excluded_users"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "conversation_broadcast_excluded_users_userId_idx" ON "conversation_broadcast_excluded_users"("userId");

-- AddForeignKey
ALTER TABLE "conversation_broadcast_companies"
ADD CONSTRAINT "conversation_broadcast_companies_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_companies"
ADD CONSTRAINT "conversation_broadcast_companies_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_departments"
ADD CONSTRAINT "conversation_broadcast_departments_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_departments"
ADD CONSTRAINT "conversation_broadcast_departments_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_excluded_users"
ADD CONSTRAINT "conversation_broadcast_excluded_users_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_broadcast_excluded_users"
ADD CONSTRAINT "conversation_broadcast_excluded_users_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages"
ADD CONSTRAINT "messages_broadcastListId_fkey"
FOREIGN KEY ("broadcastListId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
