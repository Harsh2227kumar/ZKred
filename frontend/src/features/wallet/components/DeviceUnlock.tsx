// frontend/src/features/wallet/components/DeviceUnlock.tsx
// Shown while this device's wallet is sealed by the biometric lock: unlocks it with the device passkey.
import React, { useState } from 'react';
import { Fingerprint, AlertCircle, Loader2 } from 'lucide-react';
import { biometricSecret, BiometricError } from '@/lib/biometric-unlock';
import { getDeviceLock, unlockWithDeviceSecret } from '@/lib/wallet-store';

interface DeviceUnlockProps {
  onUnlocked: () => void;
  /** Removes the sealed copy so the wallet can be restored from the passphrase backup. Omit to hide the option. */
  onForget?: () => void;
}

export const DeviceUnlock: React.FC<DeviceUnlockProps> = ({ onUnlocked, onForget }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUnlock = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const lock = await getDeviceLock();
      if (lock) await unlockWithDeviceSecret(await biometricSecret(lock.credential_id, lock.prf_salt));
      onUnlocked();
    } catch (err) {
      setErrorMsg(
        err instanceof BiometricError
          ? err.message
          : 'This passkey could not open the wallet on this device. Restore it from your encrypted backup instead.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 rounded-3xl border border-[#231a3d] bg-[#130e24] shadow-2xl space-y-5 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#06838d]/15 text-[#79bab6] mx-auto flex items-center justify-center">
        <Fingerprint className="w-6 h-6" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[#f0f7f7]">Wallet locked</h2>
        <p className="text-xs text-[#8ea5a8] leading-relaxed">
          Your keys and credentials are encrypted on this device. Unlock them with your fingerprint, face or device PIN.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleUnlock}
        disabled={isLoading}
        className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#06838d] to-[#014f85] text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
        <span>{isLoading ? 'Waiting for your device...' : 'Unlock with biometrics'}</span>
      </button>

      {onForget && (
        <button type="button" onClick={onForget} className="text-[11px] text-[#8ea5a8] hover:text-[#f0f7f7] underline cursor-pointer">
          Can't unlock? Remove this device copy and restore with your passphrase
        </button>
      )}
    </div>
  );
};
