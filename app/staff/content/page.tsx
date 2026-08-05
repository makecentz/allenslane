import type { Metadata } from "next";
import { SiteShell } from "../../site-shell";
import { ContentEventsOverview } from "./content-events-overview";

export const metadata: Metadata = {
  title: "Content & Events | Allens Lane Art Center",
  description: "Protected editorial, publication, event, and ticketing-link overview for authorized Allens Lane staff.",
};

export default function StaffContentPage() {
  return (
    <SiteShell>
      <main className="content-ops-page">
        <header className="interior-hero content-ops-hero">
          <div className="container">
            <p className="eyebrow">Staff operations / Publishing</p>
            <h1>Content &amp; Events</h1>
            <p>Review editorial content, publication readiness, event schedules, and retained ticketing links.</p>
          </div>
        </header>
        <section className="content-ops-section">
          <div className="container">
            <ContentEventsOverview />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
