"use client";

import { useEffect, useRef, useState } from "react";

import { secondaryValidationMessage } from "@/lib/secondary-workflow/validation";

interface SecondaryValidationQueryAlertProps {
  controlName: string;
}

export function SecondaryValidationQueryAlert({ controlName }: SecondaryValidationQueryAlertProps) {
  const [message, setMessage] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMessage(secondaryValidationMessage(params.get("error") ?? undefined));
  }, []);

  useEffect(() => {
    if (!message) return;

    const control = document.querySelector<HTMLElement>(`[name="${controlName}"]`);
    const form = control?.closest("form");
    const previous = form?.getAttribute("aria-describedby") ?? "";
    const describedBy = new Set(previous.split(/\s+/).filter(Boolean));
    describedBy.add("secondary-validation-error");
    form?.setAttribute("aria-describedby", [...describedBy].join(" "));
    alertRef.current?.focus();

    return () => {
      if (!form) return;
      if (previous) form.setAttribute("aria-describedby", previous);
      else form.removeAttribute("aria-describedby");
    };
  }, [controlName, message]);

  if (!message) return null;

  return (
    <div
      ref={alertRef}
      id="secondary-validation-error"
      role="alert"
      tabIndex={-1}
      className="ui-callout mb-5 text-sm"
    >
      <strong>Check this step:</strong> {message}
    </div>
  );
}
