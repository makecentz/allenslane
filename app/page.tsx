"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell } from "./site-shell";

const slides = ["/images/hero-1.jpg", "/images/hero-2.jpg", "/images/hero-3.jpg"];

const sponsors = [
  ["Weavers Way Co-op", "https://weaversway.coop/"], ["Malelani Cafe", "https://malelani.cafe/"],
  ["Salam Cafe", "https://www.alifamilyrestaurants.com/"], ["Elfant Wissahickon Realtors", "https://elfantwissahickon.com/"],
  ["Renewal by Andersen of Greater Philadelphia", "https://renewalbyandersenreplacement.com/"], ["PFCU", "https://www.pfcu.com/"],
  ["Kurtz Construction", "https://kurtzconstruction.com/"], ["Image360", "https://image360.com/"],
  ["Univest Financial", "https://www.univest.net/"], ["PrimoHoagies", "https://www.primohoagies.com/"],
  ["Blinebury Design", "https://blineburydesign.com/"], ["Philly Office Retail", "https://phillyofficeretail.com/"],
] as const;

const features = [
  {
    image: "/images/festival.jpg",
    title: "4th Annual Mt. Airy Arts Festival",
    detail: "October 3 · 11 AM – 4 PM",
    href: "/mt-airy-arts-festival/",
    linkLabel: "Learn More",
  },
  {
    image: "/images/fall-classes.png",
    title: "2026 Fall Session",
    detail: "Registration happening now!",
    href: "/classes/",
    linkLabel: "Learn More & Register",
  },
  {
    image: "/images/membership.png",
    title: "Become a Member at Allens Lane Art Center!",
    detail: "Join and sustain our creative community.",
    href: "/about/membership/",
    linkLabel: "Learn More & Join",
  },
  {
    image: "/images/theater.jpg",
    title: "The N Crowd Improv Comedy Show",
    detail: "Saturday, September 5 · 7 PM",
    href: "/theater/",
    linkLabel: "Learn More & Get Tickets",
  },
];

export default function Home() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <SiteShell>
      <main>
        <section className="home-hero" aria-label="Allens Lane Art Center introduction">
          {slides.map((image, index) => (
            <div
              className={`hero-slide ${index === slide ? "active" : ""}`}
              style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.48), rgba(0,0,0,.48)), url(${image})` }}
              key={image}
            />
          ))}
          <div className="hero-content container-wide">
            <h1>
              Bringing our community together through transformative and joyful experiences in the arts with four
              core programs—classes, performances, exhibitions, and summer camp.
            </h1>
            <div className="hero-actions">
              <Link className="light-button" href="/theater/">Live at the Lane</Link>
              <Link className="light-button" href="/classes/">Classes</Link>
              <Link className="light-button" href="/about/membership/">Membership</Link>
              <Link className="light-button" href="/events/">Calendar of Events</Link>
            </div>
          </div>
          <div className="slider-dots" aria-label="Choose hero image">
            {slides.map((_, index) => (
              <button
                key={index}
                aria-label={`Show slide ${index + 1}`}
                aria-current={index === slide}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>
        </section>

        <div className="lavender-rule" />

        <section className="feature-lead section-pad">
          <div className="container feature-lead-grid">
            <img src={features[0].image} alt="Mt. Airy Arts Festival promotional artwork" />
            <div>
              <p className="eyebrow">Community celebration</p>
              <h2>{features[0].title}</h2>
              <h3>{features[0].detail}</h3>
              <p>
                Art, music, food, neighbors, and creative discovery come together for a full day at Allens Lane.
              </p>
              <Link className="dark-button" href={features[0].href}>{features[0].linkLabel}</Link>
            </div>
          </div>
        </section>

        <section className="feature-grid section-pad-topless">
          <div className="container cards-grid">
            {features.slice(1).map((feature) => (
              <article className="feature-card" key={feature.title}>
                <Link href={feature.href} className="feature-image-wrap">
                  <img src={feature.image} alt="" />
                </Link>
                <h2>{feature.title}</h2>
                <h3>{feature.detail}</h3>
                <Link className="dark-button" href={feature.href}>{feature.linkLabel}</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="red-texture double-callout">
          <div className="container callout-grid">
            <article>
              <h2>Support Us</h2>
              <p>We rely on you to bring enriching, low-cost art education and theater programs to our neighborhood.</p>
              <Link className="light-button" href="/support/donate/">Donate Now</Link>
            </article>
            <article>
              <h2>Classes</h2>
              <p>Allens Lane Art Center offers classes for adults, teens, and youth ages 5–12. Enroll today!</p>
              <Link className="light-button" href="/classes/">All Classes</Link>
            </article>
          </div>
        </section>

        <div className="lavender-rule" />

        <section className="fund-section section-pad">
          <div className="container narrow center">
            <h2>Support provided by the Philadelphia Cultural Fund.</h2>
            <img src="/images/pcf-teal.png" alt="Philadelphia Cultural Fund" />
          </div>
        </section>

        <section className="sponsors section-pad">
          <div className="container">
            <div className="center sponsor-heading">
              <h2>Thank you to our sponsors!</h2>
              <h3>2025–2026 Sponsors</h3>
              <p>We are grateful to the organizations that support our creative community and year-round programs.</p>
            </div>
            <div className="sponsor-grid">
              {sponsors.map(([name, href], index) => (
                <a className="sponsor-logo" href={href} target="_blank" rel="noreferrer" key={name} aria-label={`Visit ${name}`}>
                  <img src={`/images/sponsor-${index + 1}.png`} alt={name} />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
