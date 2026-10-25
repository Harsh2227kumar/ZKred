ALTER TABLE "issuance_batches" ADD CONSTRAINT "issuance_batches_key_id_issuer_keys_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."issuer_keys"("key_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_batch_id_issuance_batches_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."issuance_batches"("batch_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_key_id_issuer_keys_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."issuer_keys"("key_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_status_list_id_status_lists_list_id_fk" FOREIGN KEY ("status_list_id") REFERENCES "public"."status_lists"("list_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_reissued_from_issued_credentials_id_fk" FOREIGN KEY ("reissued_from") REFERENCES "public"."issued_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credential_offers_wallet_id_idx" ON "credential_offers" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "issuance_batches_issuer_id_idx" ON "issuance_batches" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "issued_credentials_issuer_id_idx" ON "issued_credentials" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "issued_credentials_wallet_id_idx" ON "issued_credentials" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "issuer_keys_issuer_id_idx" ON "issuer_keys" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "status_lists_issuer_id_idx" ON "status_lists" USING btree ("issuer_id");--> statement-breakpoint
CREATE INDEX "verifications_request_id_idx" ON "verifications" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_status_slot_unique" UNIQUE("status_list_id","status_index");