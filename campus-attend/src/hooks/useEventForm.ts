import { useState, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';

// ── Types ───────────────────────────────────────────────────

export type EventCategory =
    | 'technical'
    | 'cultural'
    | 'social'
    | 'hackathon'
    | 'workshop'
    | 'seminar';

export interface ScheduleDay {
    day: number;
    date: string | null;
    activities: string[];
}

export interface ParsedBannerData {
    name?: string;
    description?: string;
    category?: EventCategory;
    venue?: string;
    start_datetime?: string;
    end_datetime?: string;
    learning_outcomes?: string[];
    schedule?: ScheduleDay[] | null;
    confidence: Record<string, 'high' | 'medium' | 'low'>;
    is_multipage?: boolean;
    pages_processed?: number;
}

export interface EventFormData {
    name: string;
    description: string;
    category: EventCategory | '';
    venue: string;
    start_datetime: string;
    end_datetime: string;
    learning_outcomes: string[];
    max_participants: number | '';
    difficulty_level: number;
    geofence_lat: number | '';
    geofence_lng: number | '';
    geofence_radius_m: number;
}

export const EMPTY_FORM: EventFormData = {
    name: '',
    description: '',
    category: '',
    venue: '',
    start_datetime: '',
    end_datetime: '',
    learning_outcomes: [],
    max_participants: '',
    difficulty_level: 3,
    geofence_lat: '',
    geofence_lng: '',
    geofence_radius_m: 100,
};

export interface CreatedEvent {
    id: string;
    qr_code_token: string;
}

// ── Hook ────────────────────────────────────────────────────

export function useEventForm() {
    const { user } = useAuth();

    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parsed, setParsed] = useState<ParsedBannerData | null>(null);
    const [form, setForm] = useState<EventFormData>({ ...EMPTY_FORM });
    const [uploading, setUploading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<CreatedEvent | null>(null);

    // ── Upload banner to Supabase Storage ─────────────────
    const uploadBanner = useCallback(async (file: File) => {
        setUploading(true);
        try {
            const ext = file.name.split('.').pop() ?? 'png';
            const path = `banners/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const { error } = await supabase.storage
                .from('event-banners')
                .upload(path, file, { contentType: file.type });

            if (error) throw error;

            const {
                data: { publicUrl },
            } = supabase.storage.from('event-banners').getPublicUrl(path);

            setBannerUrl(publicUrl);
            return publicUrl;
        } finally {
            setUploading(false);
        }
    }, []);

    // ── Call Edge Function to parse banner ────────────────
    const parseBanner = useCallback(
        async (fileUrl: string, fileType?: 'image' | 'pdf') => {
            setParsing(true);
            try {
                const detectedType =
                    fileType ?? (fileUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
                const { data, error } = await supabase.functions.invoke('parse-banner', {
                    body: { banner_url: fileUrl, file_type: detectedType },
                });

                if (error) throw error;

                const result = data as ParsedBannerData;
                setParsed(result);

                // Auto-fill form with extracted data
                setForm((prev) => ({
                    ...prev,
                    name: result.name ?? prev.name,
                    description: result.description ?? prev.description,
                    category: (result.category as EventCategory) ?? prev.category,
                    venue: result.venue ?? prev.venue,
                    start_datetime: result.start_datetime ?? prev.start_datetime,
                    end_datetime: result.end_datetime ?? prev.end_datetime,
                    learning_outcomes:
                        result.learning_outcomes && result.learning_outcomes.length > 0
                            ? result.learning_outcomes
                            : prev.learning_outcomes,
                }));

                return result;
            } finally {
                setParsing(false);
            }
        },
        [],
    );

    // ── Upload + parse in one call ────────────────────────
    const uploadAndParse = useCallback(
        async (file: File) => {
            const url = await uploadBanner(file);
            const fileType = file.type === 'application/pdf' ? 'pdf' as const : 'image' as const;
            return parseBanner(url, fileType);
        },
        [uploadBanner, parseBanner],
    );

    // ── Update a single form field ────────────────────────
    const updateField = useCallback(
        <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
            setForm((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    // ── Create event in DB ────────────────────────────────
    const createEvent = useCallback(async () => {
        if (!user) throw new Error('Not authenticated');
        setCreating(true);

        try {
            const { data, error } = await supabase
                .from('events')
                .insert({
                    club_admin_id: user.id,
                    name: form.name,
                    description: form.description || null,
                    category: (form.category as EventCategory) || null,
                    venue: form.venue || null,
                    start_datetime: form.start_datetime,
                    end_datetime: form.end_datetime,
                    banner_url: bannerUrl,
                    learning_outcomes:
                        form.learning_outcomes.length > 0 ? form.learning_outcomes : null,
                    max_participants:
                        form.max_participants !== '' ? Number(form.max_participants) : null,
                    difficulty_level: form.difficulty_level,
                    geofence_lat:
                        form.geofence_lat !== '' ? Number(form.geofence_lat) : null,
                    geofence_lng:
                        form.geofence_lng !== '' ? Number(form.geofence_lng) : null,
                    geofence_radius_m: form.geofence_radius_m,
                })
                .select('id, qr_code_token')
                .single();

            if (error) throw error;

            const event: CreatedEvent = {
                id: data.id,
                qr_code_token: data.qr_code_token,
            };
            setCreated(event);
            return event;
        } finally {
            setCreating(false);
        }
    }, [user, form, bannerUrl]);

    // ── Reset ─────────────────────────────────────────────
    const reset = useCallback(() => {
        setBannerUrl(null);
        setParsed(null);
        setForm({ ...EMPTY_FORM });
        setCreated(null);
    }, []);

    return {
        // State
        bannerUrl,
        parsing,
        parsed,
        form,
        uploading,
        creating,
        created,
        // Actions
        uploadBanner,
        parseBanner,
        uploadAndParse,
        updateField,
        createEvent,
        reset,
    };
}
