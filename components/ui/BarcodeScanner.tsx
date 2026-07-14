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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const scanningRef = useRef(false);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const tryDecode = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current || !videoRef.current.videoWidth) {return;}
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (!blob || !decoderRef.current) {return;}
      const result = await decoderRef.current.scanFile(blob, false);
      if (result && scanningRef.current) {
        setDecoded(result);
        setTimeout(() => { onScan(result); }, 100);
        stopCamera();
      }
    } catch { /* no barcode */ }
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    setDecoded('');
    scanningRef.current = true;
    // Pre-import html5-qrcode before starting camera
    const { Html5Qrcode } = await import('html5-qrcode');
    decoderRef.current = new Html5Qrcode('barcode-decoder-el');
    setScanning(true);
    await new Promise((r) => setTimeout(r, 50));
    for (const facing of ['environment', 'user'] as const) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
              videoRef.current!.play().then(resolve);
            };
          });
          timerRef.current = setInterval(tryDecode, 1000);
        }
        return;
      } catch { /* try next facing */ }
    }
    setScanning(false);
    scanningRef.current = false;
    setError('Camera not available. Use manual entry below.');
  }, [tryDecode]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className="space-y-3">
      <div id="barcode-decoder-el" className="hidden" />
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
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 border-2 border-red-500 opacity-50 pointer-events-none" style={{ margin: '15%' }} />
          {decoded && (
            <div className="absolute top-2 left-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded text-center z-10">
              Scanned: {decoded}
            </div>
          )}
          {!decoded && (
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white bg-black/50 py-1 z-10">
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
