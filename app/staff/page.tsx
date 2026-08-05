import type { Metadata } from "next";
import { SiteShell } from "../site-shell";
import { StaffPortal } from "./staff-portal";

export const metadata: Metadata = {
  title: "Staff Portal | Allens Lane Art Center",
  description: "Secure staff access for Allens Lane Art Center operations.",
};

export default function StaffPage() {
  return (
    <SiteShell>
      <main className="staff-page">
        <header className="interior-hero staff-hero">
          <div className="container">
            <p className="eyebrow">Allens Lane operations</p>
            <h1>Staff Portal</h1>
            <p>Secure access for programs, registrations, people, publishing, finance, and reporting.</p>
          </div>
        </header>
        <section className="staff-section">
          <div className="container staff-layout">
            <StaffPortal />
            <aside className="staff-security-card">
              <p className="eyebrow">Security requirements</p>
              <h2>Staff access requires two steps</h2>
              <ol>
                <li><strong>Sign in</strong> with your approved staff email and password.</li>
                <li><strong>Verify</strong> a code from your authenticator app.</li>
              </ol>
              <p>Customer accounts do not automatically provide staff access. Roles and permissions are approved separately by an administrator.</p>
              <p className="staff-support">Locked out or changing devices? <a href="mailto:info@allenslane.org">Contact an administrator</a>.</p>
            </aside>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
