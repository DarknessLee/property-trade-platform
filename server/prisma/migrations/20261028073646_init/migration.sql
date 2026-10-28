-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "RealNameAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "idCardMasked" TEXT NOT NULL,
    "idCardHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewerId" TEXT,
    CONSTRAINT "RealNameAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Agency_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Agency" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '房产经纪人',
    "joinedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "businessArea" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "buildYear" INTEGER NOT NULL,
    "totalBuildings" INTEGER NOT NULL DEFAULT 10,
    "plotRatio" REAL NOT NULL,
    "greenRate" REAL NOT NULL DEFAULT 0.35,
    "propertyFee" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "HouseListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "area" REAL NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "halls" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "orientation" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "totalFloors" INTEGER NOT NULL,
    "buildYear" INTEGER NOT NULL,
    "propertyType" TEXT NOT NULL,
    "decoration" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifyStatus" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT NOT NULL DEFAULT '',
    "imagesJson" TEXT NOT NULL DEFAULT '[]',
    "address" TEXT NOT NULL,
    "lng" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "listedAt" DATETIME,
    "soldAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HouseListing_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HouseListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HouseListing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HouseListing_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "demand" TEXT NOT NULL DEFAULT '',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "agentId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'B',
    "protectionUntil" DATETIME,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'following',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Customer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Showing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "actualAt" DATETIME,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "feedback" TEXT,
    "rating" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Showing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Showing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Showing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contract" (
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

-- CreateTable
CREATE TABLE "TransactionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "sortOrder" INTEGER NOT NULL,
    "plannedDate" DATETIME,
    "completedAt" DATETIME,
    "operatorId" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionProgress_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "tradeNo" TEXT NOT NULL,
    "paidAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "bizType" TEXT,
    "bizId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataDict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bizType" TEXT NOT NULL,
    "bizId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RealNameAuth_userId_key" ON "RealNameAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RealNameAuth_idCardHash_key" ON "RealNameAuth"("idCardHash");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_licenseNo_key" ON "Agency"("licenseNo");

-- CreateIndex
CREATE INDEX "Agency_parentId_idx" ON "Agency"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_licenseNo_key" ON "Agent"("licenseNo");

-- CreateIndex
CREATE INDEX "Agent_agencyId_idx" ON "Agent"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_name_district_key" ON "Community"("name", "district");

-- CreateIndex
CREATE UNIQUE INDEX "HouseListing_code_key" ON "HouseListing"("code");

-- CreateIndex
CREATE INDEX "HouseListing_status_idx" ON "HouseListing"("status");

-- CreateIndex
CREATE INDEX "HouseListing_communityId_idx" ON "HouseListing"("communityId");

-- CreateIndex
CREATE INDEX "HouseListing_agentId_idx" ON "HouseListing"("agentId");

-- CreateIndex
CREATE INDEX "HouseListing_totalPrice_idx" ON "HouseListing"("totalPrice");

-- CreateIndex
CREATE INDEX "HouseListing_area_idx" ON "HouseListing"("area");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_agentId_idx" ON "Customer"("agentId");

-- CreateIndex
CREATE INDEX "Customer_type_idx" ON "Customer"("type");

-- CreateIndex
CREATE INDEX "Customer_level_idx" ON "Customer"("level");

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Showing_code_key" ON "Showing"("code");

-- CreateIndex
CREATE INDEX "Showing_agentId_idx" ON "Showing"("agentId");

-- CreateIndex
CREATE INDEX "Showing_scheduledAt_idx" ON "Showing"("scheduledAt");

-- CreateIndex
CREATE INDEX "Showing_status_idx" ON "Showing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_name_version_key" ON "ContractTemplate"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");

-- CreateIndex
CREATE INDEX "Contract_signStatus_idx" ON "Contract"("signStatus");

-- CreateIndex
CREATE INDEX "Contract_listingId_idx" ON "Contract"("listingId");

-- CreateIndex
CREATE INDEX "Contract_agentId_idx" ON "Contract"("agentId");

-- CreateIndex
CREATE INDEX "TransactionProgress_status_idx" ON "TransactionProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionProgress_contractId_nodeType_key" ON "TransactionProgress"("contractId", "nodeType");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_tradeNo_key" ON "PaymentRecord"("tradeNo");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "OperationLog_userId_idx" ON "OperationLog"("userId");

-- CreateIndex
CREATE INDEX "OperationLog_createdAt_idx" ON "OperationLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataDict_category_idx" ON "DataDict"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DataDict_category_key_key" ON "DataDict"("category", "key");

-- CreateIndex
CREATE INDEX "Attachment_bizType_bizId_idx" ON "Attachment"("bizType", "bizId");
