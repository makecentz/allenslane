import type { Metadata } from "next";
import { SiteShell } from "../../site-shell";
import { PeopleDirectory } from "./people-directory";

export const metadata: Metadata = {
  title: "People Directory | Allens Lane Art Center",
  description: "Protected people and household directory for authorized Allens Lane staff.",
};

export default function StaffPeoplePage() {
  return (
    <SiteShell>
      <main className="people-page">
        <header className="interior-hero people-hero">
          <div className="container">
            <p className="eyebrow">Staff operations / People</p>
            <h1>People &amp; Households</h1>
            <p>Find customer contact records and their active household relationships.</p>
          </div>
        </header>
        <section className="people-section">
          <div className="container">
            <PeopleDirectory />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
