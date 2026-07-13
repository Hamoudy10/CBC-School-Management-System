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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanning(true);
    } catch (err) {
      setError('Camera access denied. Use manual entry instead.');
    }
  }, []);

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
        <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-black" style={{ maxWidth: 400, height: 240 }}>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-2 border-red-500 opacity-50" style={{ margin: '20%' }} />
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white bg-black/50 py-1">
            <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
            Scanning... Point camera at barcode
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          placeholder="Or type/scan barcode number..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <Button size="sm" onClick={handleManualSubmit} disabled={!manualInput.trim()}>
          Look Up
        </Button>
      </div>
    </div>
  );
}
