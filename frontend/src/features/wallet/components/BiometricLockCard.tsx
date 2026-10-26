// frontend/src/features/wallet/components/BiometricLockCard.tsx
// Turns the biometric device lock on or off, or locks the wallet now. The passphrase backup is unchanged either way.
import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { biometricSupported, enrollBiometric, BiometricError } from '@/lib/biometric-unlock';
import { disableDeviceLock, enableDeviceLock, getDeviceLock, lockWallet } from '@/lib/wallet-store';

interface BiometricLockCardProps {
  displayName: string;
  onLocked: () => void;
}

export const BiometricLockCard: React.FC<BiometricLockCardProps> = ({ displayName, onLocked }) => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([biometricSupported(), getDeviceLock()]).then(([s, lock]) => {
      if (mounted) {
        setSupported(s);
        setEnabled(lock !== null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleEnable = async () => {
    setIsBusy(true);
    try {
      await enableDeviceLock(await enrollBiometric(displayName));
      setEnabled(true);
      toast.success('Biometric lock on', { description: 'Your key and credentials are now encrypted on this device.' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not turn on the biometric lock.');
      if (err instanceof BiometricError && err.code === 'NO_PRF') setSupported(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Turn off the biometric lock? Your key and credentials will be stored unencrypted on this device again.')) return;
    setIsBusy(true);
    try {
      await disableDeviceLock();
      setEnabled(false);
      toast.success('Biometric lock off');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not turn off the biometric lock.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLockNow = () => {
    lockWallet();
    onLocked();
  };

  return (
    <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6]">
        <Fingerprint className="w-4 h-4" />
        <span>Biometric Lock</span>
        <span className="ml-auto text-[11px] font-mono text-[#8ea5a8]">{enabled ? 'On' : 'Off'}</span>
      </div>
      <p className="text-xs text-[#8ea5a8] leading-relaxed">
        {enabled
          ? 'Your private key and credentials are encrypted on this device and open only after a fingerprint, face or device-PIN check.'
          : supported === false
            ? 'This device cannot release an encryption secret from a passkey, so the lock is not available here. Your passphrase backup still protects the server copy.'
            : 'Encrypt the private key and credentials on this device with a passkey that opens with your fingerprint, face or device PIN.'}
      </p>
      {(enabled || supported) && (
        <div className="flex gap-2">
          {enabled ? (
            <>
              <button
                type="button"
                onClick={handleLockNow}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#231a3d] bg-[#090614] text-[#f0f7f7] hover:bg-[#1a1430] disabled:opacity-50 cursor-pointer"
              >
                Lock now
              </button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={isBusy}
                className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#231a3d] bg-[#090614] text-[#8ea5a8] hover:text-[#ff453a] disabled:opacity-50 cursor-pointer"
              >
                Turn off
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={isBusy}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#06838d] to-[#014f85] text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Protect with biometrics</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
