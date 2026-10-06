import { useState } from "react";

export function App() {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <h1>Vite</h1>
      <button type="button" id="icon"><svg width="16" height="16" aria-hidden="true" /></button>
      <button type="button" id="more" aria-expanded="false" aria-controls="more-panel" onClick={() => setOpen(!open)}>詳細</button>
      <div id="more-panel" hidden={!open}>本文</div>
    </main>
  );
}
