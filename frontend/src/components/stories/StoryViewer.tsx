import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, X } from 'lucide-react';
import type { PublicStory } from '@karolla/shared';
import { Logo } from '@/components/site/Logo';

const IMAGE_MS = 6000;

function timeAgo(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.round(minutes / 60)} h`;
}

/** Visualizador de Stories em tela cheia: toque à direita avança, à esquerda volta; segurar pausa. */
export function StoryViewer({ stories, start, onClose, onSeen }: { stories: PublicStory[]; start: number; onClose: () => void; onSeen: (id: string) => void }) {
  const [index, setIndex] = useState(start);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const story = stories[index];

  const next = useCallback(() => {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }, [index, stories.length, onClose]);
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (story) onSeen(story.id);
    setProgress(0);
  }, [story, onSeen]);

  // Fotos: temporizador. Vídeos: o progresso segue o próprio vídeo.
  useEffect(() => {
    if (!story || story.mediaType !== 'image' || paused) return;
    const started = Date.now() - progress * IMAGE_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / IMAGE_MS;
      if (p >= 1) {
        clearInterval(t);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, paused, next]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, story]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') setPaused((p) => !p);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [next, onClose]);

  if (!story) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900" role="dialog" aria-modal="true" aria-label="Stories da Karolla Pet">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[92dvh] sm:rounded-4xl">
        {story.mediaType === 'video' ? (
          <video
            key={story.id}
            ref={videoRef}
            src={story.mediaUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            muted={false}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
            onEnded={next}
            onError={next}
          />
        ) : (
          <img key={story.id} src={story.mediaUrl} alt={story.caption || 'Story da Karolla Pet'} className="h-full w-full object-contain" />
        )}

        {/* barras de progresso */}
        <div className="absolute inset-x-3 top-3 flex gap-1" aria-hidden>
          {stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${i < index ? 100 : i === index ? Math.min(100, progress * 100) : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-3 top-6 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-white drop-shadow">
            <Logo light className="origin-left scale-75" />
            <span className="text-white/80">{timeAgo(story.createdAt)}</span>
          </span>
          <span className="flex gap-1">
            <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-full p-2 text-white" aria-label={paused ? 'Continuar' : 'Pausar'}>
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-white" aria-label="Fechar stories">
              <X className="h-6 w-6" />
            </button>
          </span>
        </div>

        {/* áreas de toque */}
        <button type="button" className="absolute bottom-24 left-0 top-20 w-1/3" onClick={prev} aria-label="Story anterior" />
        <button
          type="button"
          className="absolute bottom-24 right-0 top-20 w-2/3"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          aria-label="Próximo story"
        />

        {story.caption && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-8 pt-12 text-center text-base font-medium text-white">{story.caption}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
