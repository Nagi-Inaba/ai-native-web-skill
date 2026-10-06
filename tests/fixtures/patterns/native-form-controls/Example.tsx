"use client";

import { useState } from "react";

export default function NativeFormControls() {
  const [delivery, setDelivery] = useState("Standard");
  const [updates, setUpdates] = useState(false);
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("Europe");
  const [status, setStatus] = useState("");
  return (
    <main>
      <h1>Delivery preferences</h1>
      <form onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const result = values.has("updates") ? "with email updates" : "without email updates";
        setStatus(`Saved ${values.get("delivery")} delivery in ${values.get("region")} ${result}.`);
      }}>
        <fieldset>
          <legend>Delivery speed</legend>
          {["Standard", "Express"].map((choice) => (
            <label key={choice}>
              <input type="radio" name="delivery" value={choice} checked={delivery === choice} onChange={() => setDelivery(choice)} />
              {choice}
            </label>
          ))}
        </fieldset>
        <label><input type="checkbox" name="updates" value="yes" checked={updates} onChange={(event) => setUpdates(event.target.checked)} /> Email updates</label>
        <label htmlFor="email">Email address (required with updates)</label>
        <input id="email" type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!updates} required={updates} />
        <label htmlFor="region">Region</label>
        <select id="region" name="region" value={region} onChange={(event) => setRegion(event.target.value)}><option>Europe</option><option>Asia</option></select>
        <p><button type="submit">Save preferences</button></p>
        <p role="status">{status}</p>
      </form>
    </main>
  );
}
