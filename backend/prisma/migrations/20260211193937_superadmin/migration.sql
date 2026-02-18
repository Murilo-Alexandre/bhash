-- AlterTable
ALTER TABLE "admin_accounts" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mustChangeCredentials" BOOLEAN NOT NULL DEFAULT false;
