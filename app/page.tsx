"use client";

import { useEffect, useState } from "react";
import { SiteShell } from "./site-shell";

const slides = ["/images/hero-1.jpg", "/images/hero-2.jpg", "/images/hero-3.jpg"];

const features = [
  {
    image: "/images/festival.jpg",
    title: "4th Annual Mt. Airy Arts Festival",
    detail: "October 3 · 11 AM – 4 PM",
    href: "/mt-airy-arts-festival/",
  },
  {
    image: "/images/fall-classes.png",
    title: "2026 Fall Session",
    detail: "Registration happening now!",
    href: "https://canvas.allenslane.org/",
  },
  {
    image: "/images/summer-camp.jpg",
    title: "2026 Summer Art Camp",
    detail: "June 15 – August 7",
    href: "/summer-camp/",
  },
  {
    image: "/images/theater.jpg",
    title: "Songs For A New World",
    detail: "Two weekends · July 24 – August 2",
    href: "/theater/",
  },
  {
    image: "/images/membership.png",
    title: "Become a Member",
    detail: "Join and sustain a creative community.",
    href: "/about/membership/",
  },
];

export default function Home() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
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
              <a className="light-button" href="/theater/">Live at the Lane</a>
              <a className="light-button" href="https://canvas.allenslane.org/">Classes</a>
              <a className="light-button" href="/about/membership/">Membership</a>
              <a className="light-button" href="https://canvas.allenslane.org/">Calendar of Events</a>
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
              <a className="dark-button" href={features[0].href}>Learn More</a>
            </div>
          </div>
        </section>

        <section className="feature-grid section-pad-topless">
          <div className="container cards-grid">
            {features.slice(1).map((feature) => (
              <article className="feature-card" key={feature.title}>
                <a href={feature.href} className="feature-image-wrap">
                  <img src={feature.image} alt="" />
                </a>
                <h2>{feature.title}</h2>
                <h3>{feature.detail}</h3>
                <a className="dark-button" href={feature.href}>Learn More &amp; Register</a>
              </article>
            ))}
          </div>
        </section>

        <section className="red-texture double-callout">
          <div className="container callout-grid">
            <article>
              <h2>Support Us</h2>
              <p>We rely on you to bring enriching, low-cost art education and theater programs to our neighborhood.</p>
              <a className="light-button" href="https://canvas.allenslane.org/">Donate Now</a>
            </article>
            <article>
              <h2>Classes</h2>
              <p>Allens Lane Art Center offers classes for adults, teens, and youth ages 5–12. Enroll today!</p>
              <a className="light-button" href="https://canvas.allenslane.org/">All Classes</a>
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
              {Array.from({ length: 12 }, (_, index) => (
                <div className="sponsor-logo" key={index}>
                  <img src={`/images/sponsor-${index + 1}.png`} alt="Community sponsor" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
