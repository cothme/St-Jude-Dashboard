ALTER TABLE "Patient" ADD COLUMN "dischargeDate" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "dischargeReason" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargeCondition" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargeInstructions" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargeMedications" TEXT;
ALTER TABLE "Patient" ADD COLUMN "dischargeFollowUp" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "dischargedBy" TEXT;
