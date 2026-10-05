"use client";

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

/** Voice is disabled until reviewed on-device processing can fail closed. */
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
  return (
    <div>
      <textarea
        id={id}
        name={name}
        aria-describedby={ariaDescribedBy}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={className}
      />
      <p className="mt-1 text-sm text-slate-600">
        Voice input is disabled because browser speech services may send audio off-device. Type directly instead.
      </p>
    </div>
  );
}

/** Retained for existing callers; no microphone or hotkey is registered. */
export function VoiceInputHotkeyBridge() {
  return null;
}
