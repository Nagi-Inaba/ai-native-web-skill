"use client";

import { useRef } from "react";

export default function ModalDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  function openDialog() {
    dialogRef.current?.showModal();
    titleRef.current?.focus();
  }

  return (
    <>
      <button ref={openerRef} type="button" onClick={openDialog}>Check shipping address</button>
      <dialog
        ref={dialogRef}
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        onClose={() => openerRef.current?.focus()}
      >
        <h2 ref={titleRef} id="dialog-title" tabIndex={-1}>Confirm shipping address</h2>
        <p id="dialog-description">Your order will be delivered to 1-1 Chiyoda, Chiyoda-ku, Tokyo.</p>
        <form method="dialog">
          <button value="cancel">Back</button>
          <button value="confirm">Confirm</button>
        </form>
      </dialog>
    </>
  );
}
