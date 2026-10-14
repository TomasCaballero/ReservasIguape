-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('MAINTENANCE', 'OWNER', 'ICAL');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'PASSPORT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEB_DIRECT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "ThrottleKind" AS ENUM ('IP', 'EMAIL');

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "basePriceArs" DECIMAL(12,2) NOT NULL,
    "basePriceUsd" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "icalToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonPrice" (
    "seasonId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "priceArs" DECIMAL(12,2) NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SeasonPrice_pkey" PRIMARY KEY ("seasonId","categoryId")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" UUID NOT NULL,
    "minNights" INTEGER NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pendingNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "pendingExpiryDays" INTEGER NOT NULL DEFAULT 5,
    "maxNights" INTEGER NOT NULL DEFAULT 30,
    "maxAdvanceMonths" INTEGER NOT NULL DEFAULT 12,
    "anonymizationDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOccupancy" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "bookingId" UUID,
    "blockId" UUID,
    "softLockId" UUID,

    CONSTRAINT "UnitOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftLock" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL DEFAULT (now() + interval '15 minutes'),

    CONSTRAINT "SoftLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitBlock" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "note" TEXT,
    "icalSourceId" UUID,
    "externalUid" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcalSource" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,

    CONSTRAINT "IcalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcalSyncRun" (
    "id" UUID NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "ok" BOOLEAN,
    "summary" TEXT,

    CONSTRAINT "IcalSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "anonymizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymizationRequest" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AnonymizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "categoryId" UUID,
    "categoryName" TEXT NOT NULL,
    "unitId" UUID,
    "unitAssigned" BOOLEAN NOT NULL DEFAULT false,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "source" "BookingSource" NOT NULL DEFAULT 'WEB_DIRECT',
    "currency" "Currency" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentInfoSentAt" TIMESTAMPTZ(3),
    "cancelledByExpiry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receiptPath" TEXT,
    "receiptUploadedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "kind" "ThrottleKind" NOT NULL,
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("kind","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_icalToken_key" ON "Unit"("icalToken");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOccupancy_bookingId_key" ON "UnitOccupancy"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOccupancy_blockId_key" ON "UnitOccupancy"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOccupancy_softLockId_key" ON "UnitOccupancy"("softLockId");

-- CreateIndex
CREATE INDEX "UnitOccupancy_unitId_startDate_endDate_idx" ON "UnitOccupancy"("unitId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "SoftLock_token_key" ON "SoftLock"("token");

-- CreateIndex
CREATE INDEX "SoftLock_expiresAt_idx" ON "SoftLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnitBlock_icalSourceId_externalUid_key" ON "UnitBlock"("icalSourceId", "externalUid");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_documentType_documentNumber_key" ON "Customer"("documentType", "documentNumber");

-- CreateIndex
CREATE INDEX "Booking_status_checkIn_idx" ON "Booking"("status", "checkIn");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPrice" ADD CONSTRAINT "SeasonPrice_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPrice" ADD CONSTRAINT "SeasonPrice_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "UnitBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_softLockId_fkey" FOREIGN KEY ("softLockId") REFERENCES "SoftLock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftLock" ADD CONSTRAINT "SoftLock_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftLock" ADD CONSTRAINT "SoftLock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitBlock" ADD CONSTRAINT "UnitBlock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitBlock" ADD CONSTRAINT "UnitBlock_icalSourceId_fkey" FOREIGN KEY ("icalSourceId") REFERENCES "IcalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcalSource" ADD CONSTRAINT "IcalSource_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymizationRequest" ADD CONSTRAINT "AnonymizationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── SQL manual (no expresable en schema.prisma) ─────────────

-- RNF-03: anti-superposición garantizada por la base.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Noches ocupadas = [startDate, endDate): la noche del check-out queda libre (AC-19).
ALTER TABLE "UnitOccupancy"
  ADD CONSTRAINT "UnitOccupancy_no_overlap"
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("startDate", "endDate", '[)') WITH &&
  );

-- Exactamente una de las tres referencias (reserva, bloqueo o soft lock).
ALTER TABLE "UnitOccupancy"
  ADD CONSTRAINT "UnitOccupancy_exactly_one_source"
  CHECK (num_nonnulls("bookingId", "blockId", "softLockId") = 1);

-- Rangos válidos (al menos 1 noche).
ALTER TABLE "UnitOccupancy"
  ADD CONSTRAINT "UnitOccupancy_valid_range" CHECK ("endDate" > "startDate");
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_valid_range" CHECK ("checkOut" > "checkIn");
ALTER TABLE "UnitBlock"
  ADD CONSTRAINT "UnitBlock_valid_range" CHECK ("endDate" > "startDate");

-- SystemSettings es una fila única (RF-46), con los valores por defecto.
ALTER TABLE "SystemSettings"
  ADD CONSTRAINT "SystemSettings_singleton" CHECK ("id" = 1);
INSERT INTO "SystemSettings" ("id") VALUES (1);
