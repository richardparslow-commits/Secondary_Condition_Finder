"use client";

import { useLayoutEffect } from "react";

export function RatingsFormValidationBridge() {
  useLayoutEffect(() => {
    const form = document.querySelector<HTMLFormElement>("main form");
    if (!form) return;

    form.noValidate = true;
  }, []);

  return null;
}
