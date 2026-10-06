"use client";

import { useState } from "react";

const products = [
  { id: "a", name: "Product A", stock: "In stock" },
  { id: "b", name: "Product B", stock: "Only 2 left" }
];

export default function RepeatedItems() {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <article aria-labelledby={`product-${product.id}-name`}>
              <h2 id={`product-${product.id}-name`}>{product.name}</h2>
              <p>{product.stock}</p>
              <button
                type="button"
                aria-label={`Edit: ${product.name}`}
                aria-pressed={editing === product.id}
                onClick={() => setEditing(product.id)}
              >
                Edit
              </button>
            </article>
          </li>
        ))}
      </ul>
      <p role="status">
        {editing ? `Editing ${products.find((product) => product.id === editing)?.name}.` : "Select a product to edit."}
      </p>
    </>
  );
}
