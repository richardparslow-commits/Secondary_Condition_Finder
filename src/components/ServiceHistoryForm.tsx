"use client";

import { useEffect, useState } from "react";

import { saveServiceHistory } from "@/lib/actions/presumptive";

interface ServiceBranchOption {
  code: string;
  description: string;
}

interface Props {
  locations: string[];
  serviceBranches: ServiceBranchOption[];
  serviceBranchSourceLabel: string;
  serviceBranchNotice: string;
}

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

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

export function ServiceHistoryForm({
  locations,
  serviceBranches,
  serviceBranchSourceLabel,
  serviceBranchNotice,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  function toggle(location: string) {
    setSelected((current) =>
      current.includes(location)
        ? current.filter((item) => item !== location)
        : [...current, location],
    );
  }

  function toggleBranch(code: string) {
    setSelectedBranches((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoiceSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  function startVoiceForLocations() {
    const Ctor = typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : null;
    if (!Ctor) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    setVoiceError(null);
    setVoiceInterim("");
    setVoiceListening(true);
    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setVoiceInterim(text);
      // Try to map spoken location substrings to exact location values (case-insensitive substring)
      const lower = text.toLowerCase();
      const matches = locations.filter((loc) => lower.includes(loc.toLowerCase()));
      if (matches.length > 0) setSelected((prev) => [...new Set([...prev, ...matches])]);
    };
    rec.onerror = (e) => {
      setVoiceError(e.error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${e.error}`);
      setVoiceListening(false);
    };
    rec.onend = () => setVoiceListening(false);
    try {
      rec.start();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Could not start voice input.");
      setVoiceListening(false);
    }
  }

  return (
    <form action={saveServiceHistory} className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Which service branch or branches apply to you?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Optional. These standardized values are saved as administrative reference context only. They do not change the presumptive matching logic.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {serviceBranches.map((branch) => (
            <label
              key={branch.code}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-slate-400"
            >
              <input
                type="checkbox"
                name="serviceBranchCode"
                value={branch.code}
                checked={selectedBranches.includes(branch.code)}
                onChange={() => toggleBranch(branch.code)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>
                {branch.description}
                <span className="ml-2 font-mono text-xs text-slate-500">{branch.code}</span>
              </span>
            </label>
          ))}
        </div>

        <div role="note" className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <strong className="text-slate-800">Reference source:</strong> {serviceBranchSourceLabel}. {serviceBranchNotice}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          Where did you serve?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Select every location. Presumptive eligibility depends on location and
          dates, not on any condition you are already service connected for.
        </p>
        {voiceSupported && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={startVoiceForLocations}
              disabled={voiceListening}
              aria-label={voiceListening ? "Listening for locations" : "Dictate locations by voice"}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${voiceListening ? "animate-pulse border-red-300 bg-red-50 text-red-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <span aria-hidden="true">{voiceListening ? "● " : "🎙 "}</span>
              {voiceListening ? "Listening…" : "Dictate locations"}
            </button>
            {voiceInterim && (
              <span className="text-xs text-slate-600" role="status" aria-live="polite">
                Heard: “{voiceInterim}”
              </span>
            )}
            {voiceError && (
              <span className="text-xs text-red-700" role="alert">
                {voiceError}
              </span>
            )}
          </div>
        )}
        {voiceSupported && (
          <p className="mt-1 text-xs text-slate-500">
            Voice is optional — say a location name (e.g., “Iraq”, “Republic of Vietnam”). Your speech is processed by your browser’s speech service; nothing is sent until you submit.
          </p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {locations.map((location) => (
            <label
              key={location}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm hover:border-slate-400"
            >
              <input
                type="checkbox"
                name="location"
                value={location}
                checked={selected.includes(location)}
                onChange={() => toggle(location)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>{location}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">
          When did you serve there?
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          Optional, but without dates the results cannot confirm you fall inside
          a qualifying window. Check your DD-214 for exact dates.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-700">Start date</span>
            <input type="date" name="serviceStart" className={`mt-1 ${fieldClass}`} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">End date</span>
            <input type="date" name="serviceEnd" className={`mt-1 ${fieldClass}`} />
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={selected.length === 0}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        Show presumptive conditions
      </button>
    </form>
  );
}
