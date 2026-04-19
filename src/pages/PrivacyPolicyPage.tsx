import UniversalBackButton from "@/components/UniversalBackButton";

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-2">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: April 8, 2026</p>

      <div className="space-y-6 text-sm text-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">1. Introduction</h2>
          <p>Welcome to Oracle Lunar ("we," "our," or "us"). Oracle Lunar is an AI-powered personal safety and productivity application. We are committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Oracle Lunar mobile application and related services (collectively, the "Service").</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">2. Information We Collect</h2>
          <h3 className="font-semibold mt-3 mb-1">2.1 Information You Provide</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account Information:</strong> Email address, name, and profile details when you create an account.</li>
            <li><strong>User Content:</strong> Photos, images, text, audio, and video you create, upload, or generate using our AI tools.</li>
            <li><strong>Communications:</strong> Messages you send through our AI chatbot, suggestion box, or support channels.</li>
            <li><strong>Calendar & Events:</strong> Events, special occasions, and reminders you create within the app.</li>
          </ul>
          <h3 className="font-semibold mt-3 mb-1">2.2 Information Collected Automatically</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, and mobile network information.</li>
            <li><strong>Usage Data:</strong> Features accessed, interactions with the app, timestamps, and session duration.</li>
            <li><strong>Log Data:</strong> IP address, browser type, pages viewed, and crash reports.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide, maintain, and improve the Service.</li>
            <li>To personalize your experience and deliver AI-generated content.</li>
            <li>To process your requests, transactions, and media generation.</li>
            <li>To communicate with you about updates, security alerts, and support.</li>
            <li>To detect, prevent, and address fraud, abuse, and security issues.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">4. Data Sharing & Disclosure</h2>
          <p>We do <strong>not</strong> sell your personal data. We may share information in the following limited circumstances:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Service Providers:</strong> Trusted third-party services that help us operate the app (e.g., cloud hosting, AI processing, authentication).</li>
            <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
            <li><strong>Safety:</strong> To protect the rights, safety, and property of Oracle Lunar, our users, or the public.</li>
            <li><strong>With Your Consent:</strong> When you explicitly choose to share content via the app's sharing features.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">5. Data Security</h2>
          <p>We employ industry-leading security measures including end-to-end encryption, AI-powered threat detection with 101 dedicated security AI systems, real-time monitoring, and multi-layer authentication to protect your data. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">6. Data Retention</h2>
          <p>We retain your personal data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">7. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> Request a copy of your personal data.</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information.</li>
            <li><strong>Deletion:</strong> Request deletion of your data.</li>
            <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format.</li>
            <li><strong>Opt-Out:</strong> Opt out of marketing communications at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">8. Children's Privacy</h2>
          <p>Oracle Lunar is not intended for children under the age of 13. We do not knowingly collect personal data from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete such information.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">9. Third-Party Services</h2>
          <p>The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy within the app and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-primary mb-2">11. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at:</p>
          <p className="mt-2"><strong>Oracle Lunar AI</strong><br />Email: support@oracle-lunar.online<br />Website: https://golden-vault-builder.lovable.app</p>
        </section>
      </div>
    </div>
  </div>
);

export default PrivacyPolicyPage;
