-- CreateTable
CREATE TABLE "CustomerFollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextFollowAt" DATETIME,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "listingId" TEXT,
    "complainantUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "handlerId" TEXT,
    "handlerName" TEXT,
    "handleComment" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Complaint_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleMenuConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "menuKeysJson" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerCustomerId" TEXT NOT NULL,
    "sellerCustomerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "commissionRate" REAL NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "signStatus" TEXT NOT NULL DEFAULT 'draft',
    "signMethod" TEXT,
    "esignNo" TEXT,
    "contentSnapshot" TEXT NOT NULL DEFAULT '',
    "customTerms" TEXT NOT NULL DEFAULT '',
    "signedAt" DATETIME,
    "voidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Contract_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_buyerCustomerId_fkey" FOREIGN KEY ("buyerCustomerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_sellerCustomerId_fkey" FOREIGN KEY ("sellerCustomerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("agencyId", "agentId", "amount", "buyerCustomerId", "code", "commissionAmount", "commissionRate", "contentSnapshot", "createdAt", "depositAmount", "esignNo", "id", "isDeleted", "listingId", "sellerCustomerId", "signMethod", "signStatus", "signedAt", "templateId", "updatedAt", "voidedAt") SELECT "agencyId", "agentId", "amount", "buyerCustomerId", "code", "commissionAmount", "commissionRate", "contentSnapshot", "createdAt", "depositAmount", "esignNo", "id", "isDeleted", "listingId", "sellerCustomerId", "signMethod", "signStatus", "signedAt", "templateId", "updatedAt", "voidedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");
CREATE INDEX "Contract_signStatus_idx" ON "Contract"("signStatus");
CREATE INDEX "Contract_listingId_idx" ON "Contract"("listingId");
CREATE INDEX "Contract_agentId_idx" ON "Contract"("agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CustomerFollowUp_customerId_idx" ON "CustomerFollowUp"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_code_key" ON "Complaint"("code");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_complainantUserId_idx" ON "Complaint"("complainantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMenuConfig_role_key" ON "RoleMenuConfig"("role");
