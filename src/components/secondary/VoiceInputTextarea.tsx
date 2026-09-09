"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceInputTextareaProps {
  id: string;
  name: string;
  ariaDescribedBy?: string;
  rows?: number;
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function VoiceInputTextarea({
  id,
  name,
  ariaDescribedBy,
  rows = 4,
  maxLength,
  defaultValue = "",
  placeholder,
  className,
}: VoiceInputTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseValueRef = useRef<string>(defaultValue);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current?.stop?.();
    };
  }, []);

  // Keep baseValueRef in sync with external defaultValue until user starts dictating
  useEffect(() => {
    if (!listening) baseValueRef.current = textareaRef.current?.value ?? defaultValue;
  }, [defaultValue, listening]);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (listening) return;
    setError(null);
    setInterim("");
    baseValueRef.current = textareaRef.current?.value ?? "";

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? "";
      }
      const interimText = transcript.trim();
      setInterim(interimText.slice(0, 4000));
      // Live-preview into the textarea without losing cursor intent
      if (textareaRef.current) {
        const base = baseValueRef.current;
        const separator = base && !base.endsWith("\n") && interimText ? "\n" : "";
        textareaRef.current.value = interimText ? `${base}${separator}${interimText}` : base;
        textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    recognition.onerror = (event) => {
      const map: Record<string, string> = {
        "not-allowed": "Microphone permission was denied. Enable it in browser settings and try again.",
        "no-speech": "No speech detected. Try again closer to the microphone.",
        "audio-capture": "No microphone found.",
        network: "Network error — voice recognition requires an online connection.",
      };
      setError(map[event.error] ?? `Voice input error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      // Commit interim into base if still listening (continuous may restart onend)
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start voice input.");
    }
  }, [listening]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    // onend will flip listening off; set optimistically as well
    setListening(false);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (listening) stopListening();
      else startListening();
    }
  };

  const showVoice = supported !== false; // show button; disable if unsupported
  const isUnsupported = supported === false;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          aria-describedby={ariaDescribedBy}
          rows={rows}
          maxLength={maxLength}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={className}
          aria-label={id}
        />
        {showVoice && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            onKeyDown={handleKeyDown}
            disabled={isUnsupported}
            aria-label={
              listening
                ? "Stop voice input"
                : isUnsupported
                  ? "Voice input not supported in this browser"
                  : "Start voice input — dictate to fill this field"
            }
            aria-pressed={listening}
            title={
              isUnsupported
                ? "Voice input not supported in this browser"
                : listening
                  ? "Listening — click to stop"
                  : "Dictate with your voice (Alt+V when focused)"
            }
            className={`inline-flex h-fit shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
              listening
                ? "animate-pulse border-red-300 bg-red-50 text-red-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            } disabled:opacity-40`}
          >
            <span aria-hidden="true">{listening ? "●" : "🎙"}</span>
            {listening ? "Stop" : "Voice"}
          </button>
        )}
      </div>
      {listening && interim && (
        <p className="mt-1.5 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-900" role="status" aria-live="polite">
          <strong>Listening:</strong> {interim}
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      {isUnsupported && (
        <p className="mt-1 text-xs text-slate-500">Voice input is not available in this browser. Type directly instead.</p>
      )}
      {!isUnsupported && !listening && (
        <p className="mt-1 text-xs text-slate-500">
          Tip: focus the field and press <kbd className="rounded border border-slate-300 bg-slate-50 px-1 py-0.5 font-mono text-xs">Alt</kbd>+
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1 py-0.5 font-mono text-xs">V</kbd> to dictate. Review and edit before submitting — dictated text is processed locally by your browser’s speech service.
        </p>
      )}
    </div>
  );
}

/**
 * Global hotkey: Alt+V toggles voice on the currently focused VoiceInputTextarea.
 * Mount once on the upload page.
 */
export function VoiceInputHotkeyBridge() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === "v" || event.key === "V")) {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return;
        // If focus is on a textarea that has a sibling voice button, click it
        const voiceButton = active.parentElement?.querySelector<HTMLButtonElement>('button[aria-label*="voice input" i]');
        if (voiceButton && !voiceButton.disabled) {
          event.preventDefault();
          voiceButton.click();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}
