// Re-uploads the client-side encrypted wallet backup after a local change. The passphrase lives in memory only:
// when the wallet is locked nothing is sent and the caller asks the holder to unlock (BackupModal).
import { putBackup } from '@/api/queries/wallets';
import { encryptWalletBackup } from '@/lib/wallet-crypto';
import { getFullWalletState, getSessionPassphrase } from '@/lib/wallet-store';

/** Backup format version written by the wallet (CONTRACTS §3.6 BackupIn.version). */
const BACKUP_VERSION = 1;

/** True if the encrypted backup was updated, false if the wallet is locked (no passphrase in memory). */
export async function syncEncryptedBackup(walletId: string, walletToken: string): Promise<boolean> {
  const passphrase = getSessionPassphrase();
  const state = await getFullWalletState();
  if (!passphrase || !state) return false;
  await putBackup(walletId, walletToken, { ...(await encryptWalletBackup(passphrase, state)), version: BACKUP_VERSION });
  return true;
}
