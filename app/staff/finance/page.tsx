import type { Metadata } from "next";
import { SiteShell } from "../../site-shell";
import { FinanceOverview } from "./finance-overview";

export const metadata: Metadata = {
  title: "Finance Overview | Allens Lane Art Center",
  description: "Read-only finance and reconciliation overview for authorized Allens Lane staff.",
};

export default function StaffFinancePage() {
  return (
    <SiteShell>
      <main className="finance-page">
        <header className="interior-hero finance-hero">
          <div className="container">
            <p className="eyebrow">Staff operations / Finance</p>
            <h1>Finance Overview</h1>
            <p>Read-only visibility into orders, payments, paper-check refunds, and reconciliation status.</p>
          </div>
        </header>
        <section className="finance-section">
          <div className="container">
            <FinanceOverview />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
