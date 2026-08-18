"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";

const nav = [
  { href: "#product", label: "Product" },
  { href: "#intelligence", label: "Intelligence" },
  { href: "#security", label: "Security" },
  { href: "#about", label: "About" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className={`landingHeader ${open ? "isOpen" : ""}`}>
      <a className="landingBrand" href="#top" aria-label="Gren home">
        <BrandMark />
        <span>Gren</span>
      </a>
      <nav className="landingNav" aria-label="Primary navigation">
        {nav.map((item) => (
          <a href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="landingHeaderActions">
        <Link className="landingTextLink" href="/app">Open app</Link>
        <Link className="landingPill landingPillDark" href="/app">Open vault</Link>
        <button
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="landingMenuToggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}
