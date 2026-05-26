ALTER TABLE "CheckupRecord" ADD COLUMN "appointmentId" INTEGER;
CREATE UNIQUE INDEX "CheckupRecord_appointmentId_key" ON "CheckupRecord"("appointmentId");
ALTER TABLE "CheckupRecord" ADD CONSTRAINT "CheckupRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
