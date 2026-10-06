"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Category = "all" | "sale" | "error";
type Props = {
  category: Category;
  updateCategory: (category: Category) => void;
};

const allItems = ["Regular product", "Sale product A", "Sale product B"];

async function search(category: Category) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (category === "error") throw new Error("Search failed");
  return category === "sale" ? allItems.slice(1) : allItems;
}

export default function AsyncStatus({ category, updateCategory }: Props) {
  const [items, setItems] = useState(allItems);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("3 results found.");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Searching.");
    setError("");
    try {
      const nextItems = await search(category);
      setItems(nextItems);
      setStatus(`${nextItems.length} results found.`);
    } catch {
      setError("Search failed. Try again.");
      setStatus("Search could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit}>
        <label htmlFor="category">Category</label>
        <select id="category" name="category" value={category} onChange={(event) => updateCategory(event.target.value as Category)}>
          <option value="all">All</option>
          <option value="sale">Sale</option>
          <option value="error">Simulate an error</option>
        </select>
        <button type="submit">Filter</button>
      </form>
      <p role="status">{status}</p>
      <p role="alert" hidden={!error}>{error}</p>
      <section aria-labelledby="results-heading" aria-busy={loading}>
        <h2 id="results-heading">Search results</h2>
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </>
  );
}
