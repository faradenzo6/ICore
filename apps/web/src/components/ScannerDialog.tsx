import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

type Props = { open: boolean; onClose: () => void; onResult: (text: string) => void };

export default function ScannerDialog({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (!open) return;
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;
    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        if (!deviceId) throw new Error('Камера не найдена');
        await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
          if (result) {
            onResult(result.getText());
            onClose();
          }
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      reader.reset();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="card p-4 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Сканирование штрих-кода</div>
          <button onClick={onClose} className="text-neutral-300">✕</button>
        </div>
        <video ref={videoRef} className="w-full aspect-[4/3] bg-black rounded" />
      </div>
    </div>
  );
}



