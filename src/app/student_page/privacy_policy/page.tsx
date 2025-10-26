// Privacy Policy Page – Generated to reflect actual data flows in GC-Quest
// Assumptions (can be adjusted): Contact email placeholder, no third‑party advertising, no selling of data.

// styles are now included via student.css imported in the layout

export const metadata = {
  title: 'Privacy Policy | GC-Quest'
};

export default function PrivacyPolicyPage() {
  const effectiveDate = 'September 11, 2025';
  return (
    <div className="privacy-policy-container">
      <main className="privacy-content">
        <header className="privacy-header">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="effective-date">Effective Date: {effectiveDate}</p>
        </header>

        <nav aria-label="Table of contents" className="toc-container">
          <h2 className="toc-title">Table of Contents</h2>
          <ol className="toc-list">
            <li className="toc-item"><a href="#overview" className="toc-link">1. Overview</a></li>
            <li className="toc-item"><a href="#data-we-collect" className="toc-link">2. Data We Collect</a></li>
            <li className="toc-item"><a href="#how-we-use" className="toc-link">3. How We Use Your Data</a></li>
            <li className="toc-item"><a href="#legal-bases" className="toc-link">4. Legal Bases (If Applicable)</a></li>
            <li className="toc-item"><a href="#cookies" className="toc-link">5. Cookies & Tokens</a></li>
            <li className="toc-item"><a href="#sharing" className="toc-link">6. Data Sharing & Disclosure</a></li>
            <li className="toc-item"><a href="#retention" className="toc-link">7. Data Retention</a></li>
            <li className="toc-item"><a href="#security" className="toc-link">8. Security Measures</a></li>
            <li className="toc-item"><a href="#your-rights" className="toc-link">9. Your Rights & Choices</a></li>
            <li className="toc-item"><a href="#children" className="toc-link">10. Students & Younger Users</a></li>
            <li className="toc-item"><a href="#changes" className="toc-link">11. Changes to This Policy</a></li>
            <li className="toc-item"><a href="#contact" className="toc-link">12. Contact</a></li>
          </ol>
        </nav>

        <section id="overview" className="privacy-section">
          <h2 className="section-title">1. Overview</h2>
          <p className="privacy-paragraph">GC-Quest is an educational platform that lets users create, manage, and study flashcards and related learning content. This Privacy Policy explains:</p>
          <ul className="privacy-list">
            <li>What information we collect from you</li>
            <li>How we use your personal data</li>
            <li>Your rights and choices regarding your data</li>
            <li>How we protect your information</li>
            <li>When and how we may share data</li>
          </ul>
          <p className="privacy-paragraph">By using the platform, you agree to this policy.</p>
        </section>

        <section id="data-we-collect" className="privacy-section">
          <h2 className="section-title">2. Data We Collect</h2>
          <h3 className="subsection-title">2.1 Account Information</h3>
          <ul className="privacy-list">
            <li>Username (system-generated if not provided)</li>
            <li>First & Last Name</li>
            <li>Email Address</li>
            <li>Role (student, teacher, admin – restricted)</li>
            <li>Hashed Password (we never store plain text)</li>
            <li>Optional social links (website, Facebook, Instagram)</li>
          </ul>
          <h3 className="subsection-title">2.2 Learning Content & Activity</h3>
          <ul className="privacy-list">
            <li>Flashcards (questions, answers, optional images, tags)</li>
            <li>Folders (titles, descriptions, access settings)</li>
            <li>Sharing settings (access type, shared users, permissions)</li>
            <li>Study performance metrics (review counts, correct/incorrect statistics, scheduling fields: lastReviewed, nextReview)</li>
          </ul>
          <h3 className="subsection-title">2.3 Authentication & Session</h3>
          <ul className="privacy-list">
            <li>JWT access tokens (stored in httpOnly cookies)</li>
            <li>Refresh tokens (stored securely in the database; httpOnly cookie in browser)</li>
            <li>System logs for login, registration, token lifecycle (non-sensitive metadata)</li>
          </ul>
          <h3 className="subsection-title">2.4 Automatically Collected (Minimal)</h3>
          <p className="privacy-paragraph">Currently, GC-Quest does not intentionally collect analytics beyond what is necessary for core functionality. Standard server logs (e.g., error traces) may include IP addresses for diagnostic and security purposes.</p>
          <h3 className="subsection-title">2.5 Optional / Future Data</h3>
          <p className="privacy-paragraph">Additional metrics (like advanced analytics) may be added later; updates will be reflected in this policy before activation.</p>
        </section>

        <section id="how-we-use" className="privacy-section">
          <h2 className="section-title">3. How We Use Your Data</h2>
          <p className="privacy-paragraph">We use your information for the following purposes:</p>
          <ul className="privacy-list">
            <li><strong>Account Management:</strong> Account creation, authentication, and access control</li>
            <li><strong>Content Delivery:</strong> Rendering and organizing study materials (flashcards, folders)</li>
            <li><strong>Learning Enhancement:</strong> Spaced repetition scheduling & progress analytics</li>
            <li><strong>Security:</strong> Secure session management via access/refresh tokens</li>
            <li><strong>Platform Improvement:</strong> Improving stability and security (logs, error handling)</li>
            <li><strong>Access Control:</strong> Enforcing role-based permissions (student / teacher / admin)</li>
          </ul>
        </section>

        <section id="legal-bases" className="privacy-section">
          <h2 className="section-title">4. Legal Bases (If Applicable)</h2>
          <p className="privacy-paragraph">If operating in regions that require it (e.g., EU/EEA), our processing is based on:</p>
          <ul className="privacy-list">
            <li><strong>Contract Performance:</strong> Providing platform functionality and services you&apos;ve requested</li>
            <li><strong>Legitimate Interests:</strong> Security improvements, fraud prevention, and service optimization</li>
            <li><strong>Consent:</strong> Where explicitly requested for optional features (future implementations)</li>
            <li><strong>Legal Compliance:</strong> Meeting regulatory requirements and responding to legal requests</li>
          </ul>
        </section>

        <section id="cookies" className="privacy-section">
          <h2 className="section-title">5. Cookies & Tokens</h2>
          <ul className="privacy-list">
            <li><strong>Access Token:</strong> Short-lived, httpOnly, used for API authentication.</li>
            <li><strong>Refresh Token:</strong> Longer-lived, stored both as an httpOnly cookie and in the database for rotation and revocation.</li>
            <li><strong>No marketing / tracking cookies</strong> are used at this time.</li>
            <li>Cookies are set with <span className="code-inline">sameSite=&quot;strict&quot;</span> and <span className="code-inline">secure</span> in production.</li>
          </ul>
        </section>

        <section id="sharing" className="privacy-section">
          <h2 className="section-title">6. Data Sharing & Disclosure</h2>
          <p className="privacy-paragraph">We do not sell your personal data. Data may be disclosed only in these specific circumstances:</p>
          <ul className="privacy-list">
            <li><strong>Legal Requirements:</strong> When required by law or valid legal process</li>
            <li><strong>Platform Security:</strong> When necessary to protect platform integrity or user safety</li>
            <li><strong>User-Initiated Sharing:</strong> When you explicitly share flashcards or folders using our sharing features:
              <ul className="privacy-list" style={{marginTop: '0.5rem', marginLeft: '1rem'}}>
                <li>Public access mode</li>
                <li>Link-based sharing</li>
                <li>Restricted user sharing</li>
              </ul>
            </li>
          </ul>
          <p className="privacy-paragraph"><strong>Important:</strong> Public or link-based sharing exposes only the content you choose to publish (e.g., flashcard title/cards), not your password or private profile fields.</p>
        </section>

        <section id="retention" className="privacy-section">
          <h2 className="section-title">7. Data Retention</h2>
          <p className="privacy-paragraph">We retain your data according to these policies:</p>
          <ul className="privacy-list">
            <li><strong>Active Accounts:</strong> Account & content persist while your account remains active</li>
            <li><strong>Session Tokens:</strong> Refresh tokens are retained until expiration or manual revocation (logout, security reset)</li>
            <li><strong>System Logs:</strong> Retained for a limited operational window (security/debugging) then automatically purged</li>
            <li><strong>Account Deletion:</strong> Upon account deletion, associated study content is scheduled for removal unless required for legal compliance</li>
            <li><strong>Inactive Accounts:</strong> Accounts inactive for extended periods may be subject to data archival or deletion</li>
          </ul>
        </section>

        <section id="security" className="privacy-section">
          <h2 className="section-title">8. Security Measures</h2>
          <p className="privacy-paragraph">We implement multiple layers of security to protect your data:</p>
          <ul className="privacy-list">
            <li><strong>Password Security:</strong> Password hashing with bcrypt (never stored in plain text)</li>
            <li><strong>Access Control:</strong> Role-based authorization and validation middleware</li>
            <li><strong>Token Management:</strong> JWT access & refresh token separation with httpOnly cookies</li>
            <li><strong>Cookie Security:</strong> Strict cookie attributes (sameSite, secure in production)</li>
            <li><strong>Input Validation:</strong> Comprehensive validation for email/password and schema constraints</li>
            <li><strong>Privilege Control:</strong> Least-privilege user roles (student/teacher/admin with whitelist)</li>
            <li><strong>Regular Updates:</strong> Continuous security monitoring and system updates</li>
          </ul>
          <p className="privacy-paragraph"><strong>Disclaimer:</strong> No system can be 100% secure; we continuously aim to improve defenses and follow industry best practices.</p>
        </section>

        <section id="your-rights" className="privacy-section">
          <h2 className="section-title">9. Your Rights & Choices</h2>
          <p className="privacy-paragraph">You have the following rights regarding your personal data (subject to region-specific laws):</p>
          <ul className="privacy-list">
            <li><strong>Access & Update:</strong> Access or update your profile details (name, social links) through your account settings</li>
            <li><strong>Data Deletion:</strong> Request deletion of your account and associated private content</li>
            <li><strong>Data Export:</strong> Export or copy your flashcards manually (automated export may be added in the future)</li>
            <li><strong>Privacy Control:</strong> Restrict sharing by keeping content private or using selective sharing options</li>
            <li><strong>Session Management:</strong> Revoke active sessions by logging out (invalidates refresh tokens)</li>
            <li><strong>Communication Preferences:</strong> Control how we communicate with you about platform updates</li>
            <li><strong>Data Portability:</strong> Request your data in a structured, commonly used format</li>
          </ul>
          <p className="privacy-paragraph">To exercise any of these rights, please contact us using the information in the Contact section.</p>
        </section>

        <section id="children" className="privacy-section">
          <h2 className="section-title">10. Students & Younger Users</h2>
          <p className="privacy-paragraph">The platform is designed for educational use. For younger users, please note:</p>
          <ul className="privacy-list">
            <li><strong>Educational Purpose:</strong> Platform designed specifically for learning and academic improvement</li>
            <li><strong>Guardian Responsibility:</strong> If local regulations require guardian consent for minors, institutions or guardians are responsible for ensuring compliance</li>
            <li><strong>Minimal Data Collection:</strong> We do not knowingly collect more data than necessary for learning functionality</li>
            <li><strong>Age-Appropriate Features:</strong> All features are designed with educational safety in mind</li>
            <li><strong>Institutional Use:</strong> Schools and educational institutions should ensure proper consent procedures are followed</li>
          </ul>
          <p className="privacy-paragraph">If you believe we have inadvertently collected data from a minor without proper consent, please contact us immediately.</p>
        </section>

        <section id="changes" className="privacy-section">
          <h2 className="section-title">11. Changes to This Policy</h2>
          <p className="privacy-paragraph">Material updates will be posted here with a revised effective date. Continued use after changes constitutes acceptance.</p>
        </section>

        <section id="contact" className="privacy-section">
          <h2 className="section-title">12. Contact</h2>
          <p className="privacy-paragraph">For privacy-related questions, requests, or concerns, you can reach us through:</p>
          <ul className="privacy-list">
            <li><strong>Email:</strong> <a className="privacy-link" href="mailto:privacy@gc-quest.example">privacy@gc-quest.example</a> (Replace with your official support email)</li>
            <li><strong>Subject Line:</strong> Please include &quot;Privacy Policy&quot; in your email subject for faster processing</li>
            <li><strong>Response Time:</strong> We aim to respond to privacy inquiries within 3-5 business days</li>
            <li><strong>Required Information:</strong> Please include your username or email associated with your account for verification</li>
          </ul>
          <p className="privacy-paragraph">For general support inquiries unrelated to privacy, please use our standard support channels.</p>
        </section>

        <footer className="privacy-footer">
          <p>Last updated: {effectiveDate}. This document is provided for transparency and does not constitute legal advice.</p>
        </footer>
      </main>
    </div>
  );
}