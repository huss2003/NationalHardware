import { useRef, useState } from "react";
import { Mic } from "lucide-react";

// ponytail: uses the browser's built-in SpeechRecognition (Chrome/Edge). Renders
// nothing where it's unsupported; needs internet. Replaces the field on each result.
export function VoiceButton({
  onResult,
  lang = "hi-IN",
  title = "Speak to fill",
}: {
  onResult: (text: string) => void;
  lang?: string;
  title?: string;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  if (!SR) return null;

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim();
      if (t) onResult(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      aria-pressed={listening}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border transition-colors ${
        listening
          ? "animate-pulse border-red-500 bg-red-500 text-white"
          : "border-input bg-background text-slate-500 hover:text-[#3b82f6]"
      }`}
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
