"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

type RoutePath = "/" | "/products";
type Props = {
  currentPath: string;
  navigate: (path: RoutePath) => void;
};

const routes = {
  "/": { title: "Home | Example Store", heading: "Home", body: "Explore our featured products." },
  "/products": { title: "Product list | Example Store", heading: "Product list", body: "Showing all products." }
};

export default function RouteChangeFocus({ currentPath, navigate }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(currentPath);
  const route = currentPath === "/products" ? routes["/products"] : routes["/"];

  useEffect(() => {
    document.title = route.title;
    if (previousPath.current !== currentPath) headingRef.current?.focus();
    previousPath.current = currentPath;
  }, [currentPath, route.title]);

  function follow(event: MouseEvent<HTMLAnchorElement>, path: RoutePath) {
    event.preventDefault();
    navigate(path);
  }

  return (
    <>
      <nav aria-label="Main">
        <a href="/" aria-current={currentPath === "/" ? "page" : undefined} onClick={(event) => follow(event, "/")}>Home</a>
        <a href="/products" aria-current={currentPath === "/products" ? "page" : undefined} onClick={(event) => follow(event, "/products")}>Products</a>
      </nav>
      <main>
        <h1 ref={headingRef} tabIndex={-1}>{route.heading}</h1>
        <p>{route.body}</p>
      </main>
    </>
  );
}
