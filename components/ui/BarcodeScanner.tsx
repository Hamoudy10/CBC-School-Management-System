'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [decoded, setDecoded] = useState('');
  const scannerRef = useRef<any>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setDecoded('');
    const { Html5Qrcode } = await import('html5-qrcode');
    try {
      const el = elRef.current;
      if (!el) { setError('Scanner element not found.'); return; }
      const scanner = new Html5Qrcode('barcode-reader-el');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          setDecoded(decodedText);
          scanner.pause();
          onScan(decodedText);
        },
        () => {},
      );
      setScanning(true);
    } catch (err) {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const el = elRef.current;
        if (!el) { setError('Camera not available.'); return; }
        const scanner = new Html5Qrcode('barcode-reader-el');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => { setDecoded(decodedText); scanner.pause(); onScan(decodedText); },
          () => {},
        );
        setScanning(true);
      } catch {
        setError('Camera not available. Use manual entry below.');
      }
    }
  }, [onScan]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!scanning ? (
          <Button size="sm" onClick={startCamera} leftIcon={<Camera className="h-4 w-4" />}>
            Scan Barcode
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={stopCamera} leftIcon={<CameraOff className="h-4 w-4" />}>
            Stop Camera
          </Button>
        )}
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {scanning && (
        <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-black" style={{ maxWidth: 400, minHeight: 200 }}>
          <div ref={elRef} id="barcode-reader-el" />
          {decoded && (
            <div className="absolute top-2 left-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded text-center">
              Scanned: {decoded}
            </div>
          )}
          {!decoded && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white bg-black/50 py-1">
              <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
              Point camera at barcode
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          placeholder="Or type/paste barcode number..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <Button size="sm" onClick={handleManualSubmit} disabled={!manualInput.trim()}>
          Look Up
        </Button>
      </div>
    </div>
  );
}
