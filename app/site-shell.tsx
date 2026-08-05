"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

const mainNav = [
  { label: "Classes", href: "https://canvas.allenslane.org/", children: [
    ["Youth", "https://canvas.allenslane.org/"], ["Adults", "https://canvas.allenslane.org/"],
    ["Summer Camp", "/summer-camp/"], ["Vision Thru Art", "/vision-thru-art/"],
  ] },
  { label: "Theater", href: "/theater/", children: [
    ["Current Season", "/theater/"], ["Reader’s Theater", "/readers-theater/"],
    ["Past Productions", "/theater25-26/past-productions/"], ["Submissions & Auditions", "/submissions-auditions/"],
  ] },
  { label: "Exhibitions", href: "/exhibitions/", children: [
    ["Current Exhibition", "/exhibitions/"], ["Past Exhibitions", "/exhibitions/past-exhibitions/"],
    ["Submissions", "/exhibitions/submissions/"],
  ] },
  { label: "Summer Camp", href: "/summer-camp/" },
  { label: "Community", href: "/community/" },
];

const secondaryNav = [
  { label: "About", href: "/about/", children: [
    ["Overview", "/about/"], ["Our Team", "/about/our-team/"], ["Work with Us", "/about/work-with-us/"], ["History", "/about/history/"],
  ] },
  { label: "Rentals", href: "/about/rentals/", children: [["Birthday Parties", "/about/rentals/birthday-parties/"]] },
  { label: "Events", href: "https://canvas.allenslane.org/" },
  { label: "My Account", href: "/account" },
  { label: "Contact", href: "/contact/" },
  { label: "Support", href: "/support/", children: [
    ["Memberships", "/about/membership/"], ["Volunteer", "/support/volunteer/"],
    ["Ways to Give", "/support/ways-to-give/"], ["Sponsorship Opportunities", "/support/sponsorship-opportunities/"],
  ] },
  { label: "Shop", href: "https://canvas.allenslane.org/" },
  { label: "Donate", href: "https://canvas.allenslane.org/", button: true },
];

type NavItem = { label: string; href: string; children?: string[][]; button?: boolean };

function NavList({ items, secondary = false, onNavigate }: { items: NavItem[]; secondary?: boolean; onNavigate?: () => void }) {
  return (
    <ul className={secondary ? "secondary-nav" : "main-nav"}>
      {items.map((item) => (
        <li key={item.label} className={`${item.children ? "has-children" : ""} ${item.button ? "nav-button" : ""}`}>
          <a href={item.href} onClick={onNavigate}>{item.label}{item.children && <span aria-hidden="true">⌄</span>}</a>
          {item.children && (
            <ul className="dropdown">
              {item.children.map(([label, href]) => <li key={label}><a href={href} onClick={onNavigate}>{label}</a></li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, searchOpen]);

  const closeMenus = () => setMobileOpen(false);

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header className={`site-header ${compact ? "compact" : ""}`}>
        <div className="header-inner container-wide">
          <Link className="brand" href="/" aria-label="Allens Lane Art Center home">
            <img src="/images/logo.png" alt="Allens Lane Art Center" />
          </Link>
          <div className="desktop-navigation">
            <NavList items={secondaryNav} secondary />
            <NavList items={mainNav} />
          </div>
          <div className="header-tools">
            <button className="icon-button search-button" onClick={() => setSearchOpen(true)} aria-label="Search">⌕</button>
            <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
          </div>
        </div>
      </header>

      <div className={`overlay-menu mobile-overlay ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
        <button className="overlay-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">×</button>
        <nav className="mobile-nav container">
          <NavList items={mainNav} onNavigate={closeMenus} />
          <NavList items={secondaryNav} secondary onNavigate={closeMenus} />
          <div className="mobile-contact">info@allenslane.org<br />(215) 248-0546</div>
        </nav>
      </div>

      <div className={`overlay-menu search-overlay ${searchOpen ? "open" : ""}`} aria-hidden={!searchOpen}>
        <button className="overlay-close" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button>
        <div className="search-panel">
          <h2>Search the site:</h2>
          <form action="/search/">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" name="q" placeholder="Search here..." />
            <button type="submit">Search</button>
          </form>
          <p>Try searching for: Adult Classes · Youth Classes · Theater · Exhibitions</p>
        </div>
      </div>

      <div id="content" className="page-offset">{children}</div>

      <section className="newsletter-map">
        <div className="newsletter-panel">
          <div>
            <img src="/images/logo-footer.png" alt="" />
            <h2>Sign Up for Our E-Newsletter</h2>
            <p>Get the latest updates about our programming, classes, and events sent right to your inbox!</p>
            <a href="https://allenslane.us1.list-manage.com/" className="light-button">Sign-Up!</a>
          </div>
        </div>
        <a className="map-panel" href="https://maps.google.com/?q=601+W+Allens+Lane+Philadelphia+PA+19119">
          <span>601 W Allens Lane<br />Philadelphia, PA 19119</span>
        </a>
      </section>

      <footer className="site-footer">
        <div className="container-wide footer-grid">
          <div>
            <nav className="footer-links">
              <Link href="/blog/">Blog</Link><Link href="/in-the-news/">News</Link>
              <a href="https://canvas.allenslane.org/">Donate</a><a href="https://canvas.allenslane.org/">Shop</a>
              <Link href="/staff">Staff Login</Link>
            </nav>
            <div className="footer-details">
              <p><strong>Location</strong><br />601 W Allens Lane<br />Philadelphia, PA 19119</p>
              <p><strong>Office Hours</strong><br />Monday – Thursday<br />10am – 5pm</p>
              <p><strong>General Inquiries</strong><br />info@allenslane.org<br />(215) 248-0546</p>
            </div>
            <p className="copyright">© 2026 Allens Lane Art Center</p>
          </div>
          <div className="footer-funder">
            <img src="/images/pcf.jpg" alt="Philadelphia Cultural Fund" />
            <p>Supported by Philadelphia Cultural Fund</p>
          </div>
        </div>
      </footer>
    </>
  );
}
