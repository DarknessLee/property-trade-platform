-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'listing',
    "remark" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "listingId" TEXT,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "approverId" TEXT,
    "approverName" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL DEFAULT '',
    "reviewComment" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "replyContent" TEXT,
    "repliedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Consultation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "HouseListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Consultation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PriceHistory_listingId_changedAt_idx" ON "PriceHistory"("listingId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_code_key" ON "ApprovalRequest"("code");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_listingId_idx" ON "ApprovalRequest"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_code_key" ON "Consultation"("code");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE INDEX "Consultation_toUserId_idx" ON "Consultation"("toUserId");

-- CreateIndex
CREATE INDEX "Consultation_fromUserId_idx" ON "Consultation"("fromUserId");
