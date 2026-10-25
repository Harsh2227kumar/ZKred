CREATE TYPE "public"."batch_status" AS ENUM('open', 'anchored');--> statement-breakpoint
CREATE TYPE "public"."credential_type" AS ENUM('Degree', 'GovernmentId', 'MedicalLicense');--> statement-breakpoint
CREATE TYPE "public"."issuer_kind" AS ENUM('university', 'medical_council', 'government');--> statement-breakpoint
CREATE TYPE "public"."key_status" AS ENUM('active', 'rotated', 'compromised');--> statement-breakpoint
CREATE TYPE "public"."verification_result" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "attack_forgeries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forged_set_id" uuid NOT NULL,
	"issuer_id" uuid NOT NULL,
	"credential" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attack_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"total" integer NOT NULL,
	"accepted" integer NOT NULL,
	"rejected" integer NOT NULL,
	"by_code" jsonb NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attack_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"secret_key_enc" text NOT NULL,
	"stolen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credential_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"issuer_id" uuid NOT NULL,
	"credential_type" "credential_type" NOT NULL,
	"ephemeral_public_key" text NOT NULL,
	"iv" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "issuance_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" text NOT NULL,
	"issuer_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"status" "batch_status" DEFAULT 'open' NOT NULL,
	"leaves" text[] DEFAULT '{}'::text[] NOT NULL,
	"root" text,
	"anchored_at" timestamp with time zone,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuance_batches_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "issued_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"credential_type" "credential_type" NOT NULL,
	"batch_id" text NOT NULL,
	"key_id" text NOT NULL,
	"status_list_id" text NOT NULL,
	"status_index" integer NOT NULL,
	"commitment" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"reissued_from" uuid,
	CONSTRAINT "issued_credentials_commitment_unique" UNIQUE("commitment")
);
--> statement-breakpoint
CREATE TABLE "issuer_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"public_key" text NOT NULL,
	"secret_key_enc" text NOT NULL,
	"status" "key_status" NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"compromised_from" timestamp with time zone,
	"tx_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuer_keys_key_id_unique" UNIQUE("key_id")
);
--> statement-breakpoint
CREATE TABLE "issuers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"did" text NOT NULL,
	"name" text NOT NULL,
	"kind" "issuer_kind" NOT NULL,
	"issuer_chain_id" text NOT NULL,
	"governance_address" text NOT NULL,
	"governance_key_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issuers_did_unique" UNIQUE("did"),
	CONSTRAINT "issuers_issuer_chain_id_unique" UNIQUE("issuer_chain_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verifier_id" uuid NOT NULL,
	"nl_text" text,
	"policy" jsonb NOT NULL,
	"consent_summary" text NOT NULL,
	"nonce" text NOT NULL,
	"nonce_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_requests_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "status_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" text NOT NULL,
	"issuer_id" uuid NOT NULL,
	"size" integer NOT NULL,
	"bitstring" "bytea" NOT NULL,
	"next_index" integer DEFAULT 0 NOT NULL,
	"onchain_hash" text,
	"tx_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_lists_list_id_unique" UNIQUE("list_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"result" "verification_result" NOT NULL,
	"steps" jsonb NOT NULL,
	"revealed" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"did" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verifiers_did_unique" UNIQUE("did")
);
--> statement-breakpoint
CREATE TABLE "wallet_backups" (
	"wallet_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"salt" text NOT NULL,
	"kdf_iterations" integer NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"enc_public_key" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
ALTER TABLE "attack_forgeries" ADD CONSTRAINT "attack_forgeries_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_state" ADD CONSTRAINT "attack_state_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_offers" ADD CONSTRAINT "credential_offers_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_offers" ADD CONSTRAINT "credential_offers_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issuance_batches" ADD CONSTRAINT "issuance_batches_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_credentials" ADD CONSTRAINT "issued_credentials_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issuer_keys" ADD CONSTRAINT "issuer_keys_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_requests" ADD CONSTRAINT "presentation_requests_verifier_id_verifiers_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."verifiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_lists" ADD CONSTRAINT "status_lists_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_request_id_presentation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."presentation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_backups" ADD CONSTRAINT "wallet_backups_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;