"use client";

import { useEffect, useRef, useState } from "react";

const VALIDATION_MESSAGES = {
  "select-location": "Select at least one service location to continue.",
  "date-order": "Service start date must be on or before the end date.",
  "invalid-date": "Enter valid service dates or leave them blank.",
} as const;

type ValidationCode = keyof typeof VALIDATION_MESSAGES;

export function PresumptiveValidationQueryAlert() {
  const [message, setMessage] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("error");
    if (value && Object.prototype.hasOwnProperty.call(VALIDATION_MESSAGES, value)) {
      setMessage(VALIDATION_MESSAGES[value as ValidationCode]);
    }
  }, []);

  useEffect(() => {
    if (!message) return;

    const start = document.querySelector<HTMLElement>('[name="serviceStart"]');
    const end = document.querySelector<HTMLElement>('[name="serviceEnd"]');
    const form = start?.closest("form");
    const targets = [form, start, end].filter((target): target is HTMLElement => Boolean(target));
    const previous = targets.map((target) => target.getAttribute("aria-describedby"));

    for (const target of targets) {
      const describedBy = new Set((target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
      describedBy.add("presumptive-validation-error");
      target.setAttribute("aria-describedby", [...describedBy].join(" "));
    }
    alertRef.current?.focus();

    return () => {
      targets.forEach((target, index) => {
        const prior = previous[index];
        if (prior) target.setAttribute("aria-describedby", prior);
        else target.removeAttribute("aria-describedby");
      });
    };
  }, [message]);

  if (!message) return null;

  return (
    <div
      ref={alertRef}
      id="presumptive-validation-error"
      role="alert"
      tabIndex={-1}
      className="ui-callout mb-5 text-sm"
    >
      <strong>Check the service history form:</strong> {message}
    </div>
  );
}
