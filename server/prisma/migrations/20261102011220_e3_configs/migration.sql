-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "agentRate" REAL NOT NULL,
    "coAgentRate" REAL NOT NULL,
    "storeRate" REAL NOT NULL,
    "platformRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalFlowConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'single',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalFlowConfig_type_key" ON "ApprovalFlowConfig"("type");
