import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { friendlyMessage } from '@/services/api';
import { describeFileProblem, uploadMedia } from '@/services/mediaUpload';

/** Escolher foto/vídeo do celular ou computador e enviar (com prévia e estado de envio). */
export function MediaPicker({
  kind,
  value,
  onUploaded,
  label,
}: {
  kind: 'inspiration' | 'story';
  value: { url: string; mediaType: 'image' | 'video' } | null;
  onUploaded: (media: { url: string; path: string; mediaType: 'image' | 'video' }) => void;
  label: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const problem = describeFileProblem(file, kind);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      onUploaded(await uploadMedia(file, kind));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-ink-700">
        {label} <span className="text-coral-500" aria-hidden>*</span>
      </label>
      <label
        htmlFor={id}
        className="relative flex aspect-[4/5] w-full max-w-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-ink-900/15 bg-cream-50 text-ink-500 hover:border-brand-300"
      >
        {value ? (
          value.mediaType === 'video' ? (
            <video src={value.url} className="h-full w-full object-cover" muted playsInline controls />
          ) : (
            <img src={value.url} alt="Prévia" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="flex flex-col items-center gap-2 p-4 text-center text-sm">
            <ImagePlus className="h-8 w-8" aria-hidden />
            Toque para escolher {kind === 'story' ? 'foto ou vídeo' : 'a foto'}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-brand-700">
            <Loader2 className="mb-1 h-6 w-6 animate-spin" aria-hidden />
            Enviando...
          </span>
        )}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        accept={kind === 'story' ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'}
        onChange={(e) => void onFile(e.target.files?.[0])}
        disabled={busy}
        data-testid={`media-input-${kind}`}
      />
      {value && !busy && (
        <button type="button" onClick={() => input.current?.click()} className="text-sm font-semibold text-brand-700 underline">
          Trocar arquivo
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
