import type { Metadata } from "next";
import { SiteShell } from "../../site-shell";
import { ProgramsOverview } from "./programs-overview";

export const metadata: Metadata = {
  title: "Programs & Registration | Allens Lane Art Center",
  description: "Protected catalog, class, enrollment, and waitlist overview for authorized Allens Lane staff.",
};

export default function StaffProgramsPage() {
  return (
    <SiteShell>
      <main className="programs-page">
        <header className="interior-hero programs-hero">
          <div className="container">
            <p className="eyebrow">Staff operations / Programs</p>
            <h1>Programs &amp; Registration</h1>
            <p>Review the active catalog, schedules, enrollment, capacity, and waitlist activity.</p>
          </div>
        </header>
        <section className="programs-section">
          <div className="container">
            <ProgramsOverview />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
