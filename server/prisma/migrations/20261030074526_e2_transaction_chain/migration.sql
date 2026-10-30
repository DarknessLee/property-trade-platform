-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "annualRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "documentsJson" TEXT NOT NULL DEFAULT '[]',
    "rejectReason" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "disbursedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoanApplication_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppraisalOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "loanId" TEXT,
    "institutionName" TEXT NOT NULL,
    "appraiserName" TEXT NOT NULL,
    "appointmentAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appraisedValue" INTEGER,
    "reportNo" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppraisalOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppraisalOrder_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LoanApplication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscrowAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNoMasked" TEXT NOT NULL,
    "agreementNo" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "releasedAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EscrowAccount_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escrowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "nodeType" TEXT,
    "tradeNo" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscrowTransaction_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialChecklist_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receiptNo" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferAppointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "appointmentAt" DATETIME NOT NULL,
    "hallName" TEXT NOT NULL,
    "appointmentNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferAppointment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistrationApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "acceptNo" TEXT,
    "acceptedAt" DATETIME,
    "completedAt" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegistrationApplication_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "totalCommission" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommissionSettlement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "CommissionAllocation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CommissionSettlement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_code_key" ON "LoanApplication"("code");

-- CreateIndex
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");

-- CreateIndex
CREATE INDEX "LoanApplication_contractId_idx" ON "LoanApplication"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalOrder_code_key" ON "AppraisalOrder"("code");

-- CreateIndex
CREATE INDEX "AppraisalOrder_status_idx" ON "AppraisalOrder"("status");

-- CreateIndex
CREATE INDEX "AppraisalOrder_contractId_idx" ON "AppraisalOrder"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAccount_code_key" ON "EscrowAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowAccount_contractId_key" ON "EscrowAccount"("contractId");

-- CreateIndex
CREATE INDEX "EscrowAccount_status_idx" ON "EscrowAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_tradeNo_key" ON "EscrowTransaction"("tradeNo");

-- CreateIndex
CREATE INDEX "EscrowTransaction_escrowId_idx" ON "EscrowTransaction"("escrowId");

-- CreateIndex
CREATE INDEX "MaterialChecklist_contractId_idx" ON "MaterialChecklist"("contractId");

-- CreateIndex
CREATE INDEX "TaxRecord_contractId_idx" ON "TaxRecord"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferAppointment_code_key" ON "TransferAppointment"("code");

-- CreateIndex
CREATE INDEX "TransferAppointment_contractId_idx" ON "TransferAppointment"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApplication_code_key" ON "RegistrationApplication"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApplication_contractId_key" ON "RegistrationApplication"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlement_code_key" ON "CommissionSettlement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSettlement_contractId_key" ON "CommissionSettlement"("contractId");

-- CreateIndex
CREATE INDEX "CommissionSettlement_status_idx" ON "CommissionSettlement"("status");

-- CreateIndex
CREATE INDEX "CommissionAllocation_settlementId_idx" ON "CommissionAllocation"("settlementId");
