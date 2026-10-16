-- D-04: un cliente solo puede tener una solicitud de anonimización pendiente.
CREATE UNIQUE INDEX "AnonymizationRequest_one_pending" ON "AnonymizationRequest"("customerId") WHERE "completedAt" IS NULL;
