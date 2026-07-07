'use client';

import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';

import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

export function WalletConnect({ onVerified }: { onVerified?: () => void }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const verifiedFor = useRef<string | null>(null);
  const t = useT();

  // ask the server for a ton_proof challenge before the connect dialog opens
  useEffect(() => {
    let cancelled = false;
    tonConnectUI.setConnectRequestParameters({ state: 'loading' });
    api<{ payload: string }>('/api/tonproof/payload', { method: 'POST' })
      .then(({ payload }) => {
        if (cancelled) return;
        tonConnectUI.setConnectRequestParameters({
          state: 'ready',
          value: { tonProof: payload },
        });
      })
      .catch(() => {
        if (!cancelled) tonConnectUI.setConnectRequestParameters(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tonConnectUI]);

  // hand the wallet's proof to the server; verified=true only after it checks out
  useEffect(() => {
    const proofItem = wallet?.connectItems?.tonProof;
    const address = wallet?.account.address;
    if (!address || !proofItem || !('proof' in proofItem)) return;
    if (verifiedFor.current === address) return;
    verifiedFor.current = address;

    const { proof } = proofItem;
    void api('/api/tonproof/verify', {
      method: 'POST',
      body: JSON.stringify({
        address,
        proof: {
          timestamp: proof.timestamp,
          domain: { lengthBytes: proof.domain.lengthBytes, value: proof.domain.value },
          payload: proof.payload,
          signature: proof.signature,
        },
      }),
    })
      .then(() => onVerified?.())
      .catch((error: unknown) => {
        console.warn('[tonproof] verification failed:', error);
      });
  }, [wallet, onVerified]);

  return (
    <div className="flex flex-col items-start gap-2">
      <TonConnectButton />
      <p className="text-xs text-hint">{t('connectHint')}</p>
    </div>
  );
}
