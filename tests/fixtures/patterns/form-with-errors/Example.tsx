"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

export default function FormWithErrors() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = emailRef.current;
    if (!input?.validity.valid) {
      setError(input?.validity.valueMissing ? "Enter your email address." : "Check the email address format.");
      setStatus("");
      input?.focus();
      return;
    }
    setError("");
    setStatus("Notification address registered.");
  }

  return (
    <form noValidate onSubmit={submit}>
      <label htmlFor="email">Email address (required)</label>
      <p id="email-help">We will send order notifications to this address.</p>
      <input
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-describedby="email-help email-error"
        aria-invalid={error ? true : undefined}
        onChange={() => setError("")}
      />
      <p id="email-error" role="alert" hidden={!error}>{error}</p>
      <button type="submit">Register</button>
      <p role="status" hidden={!status}>{status}</p>
    </form>
  );
}
