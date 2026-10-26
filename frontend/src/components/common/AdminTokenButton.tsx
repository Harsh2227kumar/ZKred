import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { adminToken } from '@/api/client';

interface AdminTokenButtonProps {
  /** Called after the token is saved, so pages can refetch admin-only data. */
  onSaved?: () => void;
}

/** Shows whether an admin token is set and lets the issuer enter it (sessionStorage only). */
export const AdminTokenButton: React.FC<AdminTokenButtonProps> = ({ onSaved }) => {
  const [token, setToken] = useState(adminToken.get);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const save = () => {
    adminToken.set(draft.trim());
    setToken(draft.trim());
    setOpen(false);
    onSaved?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(token);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground/80 hover:bg-muted transition-colors"
      >
        <Key className="w-3.5 h-3.5 text-primary" />
        <span>{token ? 'Admin token set' : 'Enter admin token'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            className="bg-card border border-border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h3 className="text-lg font-bold text-foreground">Issuer admin token</h3>
            <p className="text-xs text-muted-foreground">
              Registering issuers, issuing, anchoring, revoking, reporting a compromise and the attack console need the admin
              bearer token. It is kept in this tab's sessionStorage only.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="ISSUER_ADMIN_TOKEN"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                Save token
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
