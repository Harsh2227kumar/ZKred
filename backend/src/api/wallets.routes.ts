import { Router } from "express";
import { claimOffer, createWallet, getBackup, listOffers, lookupWallet, saveBackup } from "../core/wallets";
import { BackupIn, WalletCreate, WalletLookupQuery, WalletOfferParams, WalletParams } from "../schemas/wallets.schema";
import { requireWalletOwner } from "./middleware/auth";

export const walletsRouter = Router();

walletsRouter.post("/wallets", async (req, res) => {
  res.status(201).json(await createWallet(WalletCreate.parse(req.body)));
});

walletsRouter.get("/wallets/lookup", async (req, res) => {
  res.json(await lookupWallet(WalletLookupQuery.parse(req.query).display_name));
});

walletsRouter.get("/wallets/:wallet_id/offers", requireWalletOwner, async (req, res) => {
  res.json(await listOffers(WalletParams.parse(req.params).wallet_id));
});

walletsRouter.post("/wallets/:wallet_id/offers/:offer_id/claim", requireWalletOwner, async (req, res) => {
  const { wallet_id, offer_id } = WalletOfferParams.parse(req.params);
  res.json(await claimOffer(wallet_id, offer_id));
});

walletsRouter.put("/wallets/:wallet_id/backup", requireWalletOwner, async (req, res) => {
  res.json(await saveBackup(WalletParams.parse(req.params).wallet_id, BackupIn.parse(req.body)));
});

walletsRouter.get("/wallets/:wallet_id/backup", requireWalletOwner, async (req, res) => {
  res.json(await getBackup(WalletParams.parse(req.params).wallet_id));
});
