CREATE INDEX "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");
CREATE INDEX "ActivityLog_entity_timestamp_idx" ON "ActivityLog"("entity", "timestamp");
CREATE INDEX "ActivityLog_severity_timestamp_idx" ON "ActivityLog"("severity", "timestamp");
