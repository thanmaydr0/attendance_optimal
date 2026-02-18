import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RefreshCw, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../api/supabase';

// ── Types ───────────────────────────────────────────────────

type QRSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<QRSize, { px: number; label: string }> = {
    sm: { px: 128, label: 'Small' },
    md: { px: 256, label: 'Medium' },
    lg: { px: 512, label: 'Large' },
};

interface QRCodePanelProps {
    eventId: string;
    qrCodeToken: string;
    eventName: string;
    onTokenRefreshed?: (newToken: string) => void;
}

// ── Component ───────────────────────────────────────────────

export default function QRCodePanel({
    eventId,
    qrCodeToken,
    eventName,
    onTokenRefreshed,
}: QRCodePanelProps) {
    const [size, setSize] = useState<QRSize>('md');
    const [refreshing, setRefreshing] = useState(false);
    const [token, setToken] = useState(qrCodeToken);
    const qrRef = useRef<HTMLDivElement>(null);

    const checkinUrl = `${window.location.origin}/checkin/${token}`;
    const currentSize = SIZE_MAP[size];

    // ── Download as PNG ─────────────────────────────────
    const handleDownload = useCallback(() => {
        const svgEl = qrRef.current?.querySelector('svg');
        if (!svgEl) return;

        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);

            const a = document.createElement('a');
            a.download = `${eventName.replace(/\s+/g, '-').toLowerCase()}-qr-${currentSize.label.toLowerCase()}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
            toast.success(`QR code downloaded (${currentSize.label})`);
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }, [eventName, currentSize]);

    // ── Refresh token ───────────────────────────────────
    const handleRefreshToken = useCallback(async () => {
        if (!confirm('Refresh the QR token? The old QR code will stop working.')) return;

        setRefreshing(true);
        try {
            // Generate new random token server-side
            const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

            const { error } = await supabase
                .from('events')
                .update({ qr_code_token: newToken })
                .eq('id', eventId);

            if (error) throw error;

            setToken(newToken);
            onTokenRefreshed?.(newToken);
            toast.success('QR token refreshed! Share the new QR code.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to refresh token');
        } finally {
            setRefreshing(false);
        }
    }, [eventId, onTokenRefreshed]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Check-in QR Code</h3>

            {/* QR code */}
            <div className="flex justify-center" ref={qrRef}>
                <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 inline-block">
                    <QRCodeSVG
                        value={checkinUrl}
                        size={currentSize.px}
                        level="H"
                        includeMargin
                    />
                </div>
            </div>

            {/* Size selector */}
            <div className="flex justify-center gap-1">
                {(Object.entries(SIZE_MAP) as [QRSize, { px: number; label: string }][]).map(
                    ([key, { label }]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setSize(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${size === key
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {label}
                        </button>
                    ),
                )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                    <Download className="w-4 h-4" /> Download PNG
                </button>

                <button
                    type="button"
                    onClick={handleRefreshToken}
                    disabled={refreshing}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
                >
                    {refreshing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    Refresh Token
                </button>
            </div>

            {/* Check-in URL display */}
            <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-500 font-mono break-all">
                {checkinUrl}
            </div>
        </div>
    );
}
