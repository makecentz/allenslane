import type { Metadata } from "next";
import { SiteShell } from "../../site-shell";
import { AdministrationOverview } from "./administration-overview";

export const metadata: Metadata = {
  title: "Administration Overview | Allens Lane Art Center",
  description: "Protected staff access and audit overview for authorized Allens Lane administrators.",
};

export default function StaffAdministrationPage() {
  return (
    <SiteShell>
      <main className="admin-page">
        <header className="interior-hero admin-hero">
          <div className="container">
            <p className="eyebrow">Staff operations / Administration</p>
            <h1>Administration &amp; Audit</h1>
            <p>Review staff-account status, role assignments, and recent privileged activity.</p>
          </div>
        </header>
        <section className="admin-section">
          <div className="container">
            <AdministrationOverview />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
