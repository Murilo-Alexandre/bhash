CREATE TABLE "conversation_automatic_rules" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "companyId" TEXT,
  "departmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversation_automatic_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_automatic_rules_conversationId_idx"
  ON "conversation_automatic_rules"("conversationId");

CREATE INDEX "conversation_automatic_rules_companyId_idx"
  ON "conversation_automatic_rules"("companyId");

CREATE INDEX "conversation_automatic_rules_departmentId_idx"
  ON "conversation_automatic_rules"("departmentId");

CREATE INDEX "conversation_automatic_rules_conversationId_companyId_departmentId_idx"
  ON "conversation_automatic_rules"("conversationId", "companyId", "departmentId");

ALTER TABLE "conversation_automatic_rules"
  ADD CONSTRAINT "conversation_automatic_rules_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_automatic_rules"
  ADD CONSTRAINT "conversation_automatic_rules_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_automatic_rules"
  ADD CONSTRAINT "conversation_automatic_rules_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
