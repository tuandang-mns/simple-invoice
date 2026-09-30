-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Pending', 'Paid');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_reference" TEXT,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "currency_symbol" TEXT NOT NULL,
    "description" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "customer_fullname" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_mobile" TEXT,
    "customer_address" TEXT,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "invoice_sub_total" DECIMAL(18,2) NOT NULL,
    "total_tax" DECIMAL(18,2) NOT NULL,
    "total_discount" DECIMAL(18,2) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "total_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "invoices_invoice_date_idx" ON "invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_total_amount_idx" ON "invoices"("total_amount");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_created_by_idx" ON "invoices"("created_by");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written constraints & indexes (not expressible in schema.prisma).
-- See docs/ARCHITECTURE.md §3 "Constraints & indexes".
-- ---------------------------------------------------------------------------

-- Invoice numbers are unique at the DB level, case-insensitively (race-safe).
CREATE UNIQUE INDEX "invoices_invoice_number_lower_key" ON "invoices" (lower("invoice_number"));

-- Integrity rules that must hold regardless of application code.
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_due_date_on_or_after_invoice_date" CHECK ("due_date" >= "invoice_date"),
  ADD CONSTRAINT "invoices_tax_rate_range" CHECK ("tax_rate" >= 0 AND "tax_rate" <= 100),
  ADD CONSTRAINT "invoices_amounts_non_negative" CHECK (
    "invoice_sub_total" >= 0 AND "total_tax" >= 0 AND "total_discount" >= 0
    AND "total_amount" >= 0 AND "total_paid" >= 0
  ),
  ADD CONSTRAINT "invoices_balance_consistent" CHECK ("balance_amount" = "total_amount" - "total_paid");

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "invoice_items_rate_positive" CHECK ("rate" > 0);

-- Trigram indexes so ILIKE '%keyword%' search can use an index instead of a full scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "invoices_invoice_number_trgm_idx" ON "invoices" USING GIN ("invoice_number" gin_trgm_ops);
CREATE INDEX "invoices_customer_fullname_trgm_idx" ON "invoices" USING GIN ("customer_fullname" gin_trgm_ops);
