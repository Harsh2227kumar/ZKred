import { Router } from "express";
import {
  anchorBatch,
  getBatchLeaves,
  getStatusList,
  issueCredential,
  listBatches,
  listIssuedCredentials,
  reissue,
  revokeCredential,
} from "../core/issuance";
import {
  BatchParams,
  IssueCredentialIn,
  IssuerBatchParams,
  IssuerCredentialParams,
  ListQuery,
  ReissueIn,
  StatusListParams,
} from "../schemas/issuance.schema";
import { IssuerParams } from "../schemas/issuers.schema";
import { requireAdmin, requireWalletOwnerOfBody } from "./middleware/auth";

export const issuanceRouter = Router();

issuanceRouter.post("/issuers/:issuer_id/credentials", requireAdmin, async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.status(201).json(await issueCredential(issuer_id, IssueCredentialIn.parse(req.body)));
});

issuanceRouter.get("/issuers/:issuer_id/credentials", requireAdmin, async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.json(await listIssuedCredentials(issuer_id, ListQuery.parse(req.query)));
});

issuanceRouter.get("/issuers/:issuer_id/batches", async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.json(await listBatches(issuer_id));
});

issuanceRouter.post("/issuers/:issuer_id/batches/:batch_id/anchor", requireAdmin, async (req, res) => {
  const { issuer_id, batch_id } = IssuerBatchParams.parse(req.params);
  res.json(await anchorBatch(issuer_id, batch_id as `0x${string}`));
});

issuanceRouter.get("/batches/:batch_id/leaves", async (req, res) => {
  const { batch_id } = BatchParams.parse(req.params);
  res.json(await getBatchLeaves(batch_id as `0x${string}`));
});

issuanceRouter.get("/status-lists/:list_id", async (req, res) => {
  const { list_id } = StatusListParams.parse(req.params);
  res.json(await getStatusList(list_id as `0x${string}`));
});

issuanceRouter.post("/issuers/:issuer_id/credentials/:credential_id/revoke", requireAdmin, async (req, res) => {
  const { issuer_id, credential_id } = IssuerCredentialParams.parse(req.params);
  res.json(await revokeCredential(issuer_id, credential_id));
});

issuanceRouter.post("/issuers/:issuer_id/reissue", requireWalletOwnerOfBody, async (req, res) => {
  const { issuer_id } = IssuerParams.parse(req.params);
  res.status(201).json(await reissue(issuer_id, ReissueIn.parse(req.body)));
});
