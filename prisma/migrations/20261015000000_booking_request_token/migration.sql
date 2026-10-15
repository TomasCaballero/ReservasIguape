-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "requestToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_requestToken_key" ON "Booking"("requestToken");

