import { Lock, Globe, GraduationCap, FlaskConical, BookOpen, Rocket, FileText, Settings2, RotateCcw, Clock, Users, CheckCircle2, HelpCircle, Building2 } from 'lucide-react'

export default function Guide() {
  return (
    <div style={{ maxWidth: '860px' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '2rem',
      }}>
        <div style={{ marginBottom: '0.5rem' }}><Lock size={32} color='#a78bfa' /></div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>
          What is this system?
        </h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: '1.8', fontSize: '0.95rem' }}>
          This is a <strong style={{ color: '#c4b5fd' }}>Certificate Authority (CA) Management System</strong> —
          a tool that creates and manages <strong style={{ color: '#c4b5fd' }}>digital certificates</strong>.
          Think of digital certificates like <strong style={{ color: '#67e8f9' }}>digital ID cards</strong> for
          people, websites, and software. Just like a government issues passports to prove your identity,
          this system issues certificates to prove digital identities.
        </p>
      </div>

      <Section Icon={Globe} title="Real World Example">
        <p style={{ color: 'var(--text-dim)', lineHeight: '1.8', marginBottom: '1rem' }}>
          When you visit <code style={codeStyle}>https://google.com</code>, you see a padlock in your browser.
          That padlock means Google has a <strong style={{ color: '#fff' }}>certificate</strong> proving it's really Google
          and not someone pretending to be Google.
        </p>
        <p style={{ color: 'var(--text-dim)', lineHeight: '1.8', marginBottom: '1rem' }}>
          Someone had to <em>issue</em> that certificate — that's what a Certificate Authority does.
          Big CAs like DigiCert or Let's Encrypt do this for the internet.
          <strong style={{ color: '#c4b5fd' }}> This system lets you run your own CA</strong> —
          for a company's internal network, for learning, or for research.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          {[
            { Icon: Building2,      title: 'Small Company', desc: 'Issue certificates to employees for VPN access, email signing, internal websites' },
            { Icon: GraduationCap,  title: 'Learning',      desc: 'Understand how HTTPS, digital signatures, and PKI actually work under the hood' },
            { Icon: FlaskConical,   title: 'Research',      desc: 'Study certificate lifecycle management, automation, and PKI usability' },
          ].map(c => (
            <div key={c.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ marginBottom: '0.5rem' }}><c.Icon size={22} color='#a78bfa' /></div>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>{c.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: '1.6' }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section Icon={BookOpen} title="Key Concepts (Plain English)">
        {[
          { term: 'Certificate Authority (CA)', def: 'The master authority that signs and vouches for all certificates. Like a government that issues passports. You create this first.' },
          { term: 'Digital Certificate', def: 'A file (ending in .pem) that contains someone\'s identity info + a digital signature from the CA proving it\'s legitimate. Like a passport.' },
          { term: 'Private Key', def: 'A secret file that only the certificate owner has. Used to prove they are who they say they are. Never share this.' },
          { term: 'CSR (Certificate Signing Request)', def: 'A request sent to the CA saying "please issue me a certificate". Contains identity info but not the private key.' },
          { term: 'Revocation', def: 'Cancelling a certificate before it expires. Like cancelling a passport when someone leaves a company.' },
          { term: 'CRL (Certificate Revocation List)', def: 'A public list of all cancelled certificates. Anyone can check this to see if a certificate is still valid.' },
          { term: 'OCSP', def: 'A faster way to check if one specific certificate is still valid, instead of downloading the whole CRL.' },
          { term: 'Intermediate CA', def: 'A sub-authority under the root CA. The root CA signs the intermediate, and the intermediate signs everyday certificates. More secure because the root key stays offline.' },
          { term: 'Template', def: 'A preset configuration for a certificate type. Like a form template — TLS Server, Email Signing, Code Signing each have different settings.' },
        ].map(({ term, def }) => (
          <div key={term} style={{ display: 'flex', gap: '1rem', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: '220px', color: '#c4b5fd', fontWeight: 600, fontSize: '0.88rem', paddingTop: '2px' }}>{term}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', lineHeight: '1.7' }}>{def}</div>
          </div>
        ))}
      </Section>

      <Section Icon={Rocket} title="Getting Started — Step by Step">
        <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: '1.2rem', lineHeight: 1.7 }}>
          Follow these steps in order the first time you use the system.
        </div>
        {[
          { step: 1, label: 'Initialise the CA', tab: 'Init CA', desc: 'Go to Init CA in the sidebar and click the Init button. This creates your root Certificate Authority — the master key that signs everything. You only do this once. If a CA already exists, it just loads it.' },
          { step: 2, label: 'Issue a Certificate', tab: 'Issue Cert', desc: 'Go to Issue Cert. Fill in a name, email, organisation, and country (2-letter code like IN, US, GB). Choose a template — use client_auth for a person, tls_server for a website. Click Issue Certificate. You\'ll get a PEM certificate and a serial number.' },
          { step: 3, label: 'View Your Certificates', tab: 'Certificates', desc: 'Go to Certificates to see all issued certificates in a table. You can see who they were issued to, when they expire, and whether they\'re active or revoked.' },
          { step: 4, label: 'Verify a Certificate', tab: 'Verify', desc: 'Go to Verify. Upload the .pem certificate file. The system checks: Is the signature valid? Has it expired? Has it been revoked? You\'ll get a clear Valid or Invalid result with reasons.' },
          { step: 5, label: 'Revoke a Certificate', tab: 'Revoke', desc: 'If someone leaves the company or a certificate is compromised, go to Revoke, paste the serial number, choose a reason, and click Revoke. The certificate is immediately cancelled and added to the CRL.' },
          { step: 6, label: 'Set Up Automation', tab: 'Policy Manager', desc: 'Go to Policy Manager and create a policy for client_auth. Set max validity to 365 days, turn on Auto-Renew, set "Renew 30 days before expiry". Now the system will automatically renew certificates before they expire — no manual work needed.' },
        ].map(({ step, label, tab, desc }) => (
          <div key={step} style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.2rem' }}>
            <div style={{
              minWidth: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
            }}>{step}</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.92rem' }}>
                {label}
                <span style={{ marginLeft: '0.6rem', background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                  {tab}
                </span>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.87rem', lineHeight: '1.7' }}>{desc}</div>
            </div>
          </div>
        ))}
      </Section>

      <Section Icon={FileText} title="Certificate Types — Which One to Use?">
        {[
          { name: 'client_auth',   color: '#a78bfa', use: 'For a person',         when: 'Employee needs VPN access, internal system login, or general identity certificate', example: 'Alice from Engineering needs a certificate to log into the company VPN' },
          { name: 'tls_server',    color: '#67e8f9', use: 'For a website/server', when: 'You want HTTPS on an internal website or API server', example: 'Your internal dashboard at https://dashboard.company.local needs a certificate' },
          { name: 'email_signing', color: '#4ade80', use: 'For email',            when: 'Someone needs to digitally sign or encrypt emails (S/MIME)', example: 'The CEO wants to send emails that recipients can verify are really from them' },
          { name: 'code_signing',  color: '#fb923c', use: 'For software',         when: 'A developer needs to sign scripts or executables to prove they haven\'t been tampered with', example: 'A deployment script needs to be signed so servers know it\'s legitimate' },
        ].map(({ name, color, use, when, example }) => (
          <div key={name} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
              <code style={{ ...codeStyle, color, background: `${color}22`, padding: '3px 10px' }}>{name}</code>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{use}</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '0.4rem' }}><strong style={{ color: 'var(--text)' }}>When:</strong> {when}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.7 }}><strong style={{ color: 'var(--text-dim)' }}>Example:</strong> {example}</div>
          </div>
        ))}
      </Section>

      <Section Icon={Settings2} title="Self-Managing PKI — What Makes This Different">
        <p style={{ color: 'var(--text-dim)', lineHeight: '1.8', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Normal PKI systems require a dedicated IT admin to manually track certificate expiry and renew them.
          If they forget, certificates expire and services break. This system <strong style={{ color: '#c4b5fd' }}>manages itself automatically</strong>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { Icon: RotateCcw,    title: 'Auto-Renewal',         desc: 'Set a policy saying "renew 30 days before expiry". The system checks daily and automatically issues a new certificate, revoking the old one.' },
            { Icon: Clock,        title: 'Expiry Warnings',      desc: 'The dashboard shows all certificates expiring soon. Filter by 7, 14, 30, 60, or 90 days ahead.' },
            { Icon: Users,        title: 'Self-Service Requests',desc: 'Employees request certificates themselves by filling a simple form. No PKI knowledge needed. Admin approves or rejects from a queue.' },
            { Icon: CheckCircle2, title: 'Approval Policies',    desc: 'Set per-template rules. Code signing certificates require admin approval. Client auth certificates are auto-approved. You control the rules.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ marginBottom: '0.4rem' }}><Icon size={18} color='#a78bfa' /></div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem' }}>{title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.83rem', lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section Icon={HelpCircle} title="Common Questions">
        {[
          { q: 'I issued a certificate — where is the file?', a: 'The PEM text is shown in the result box after issuing. Copy it and save it as a .pem file. The file is also saved in storage/certs/ in the project folder.' },
          { q: 'What is a serial number?', a: 'Every certificate gets a unique serial number when issued. It\'s like a passport number. You use it to look up, verify, or revoke a specific certificate.' },
          { q: 'What\'s the difference between Root CA and Intermediate CA?', a: 'The Root CA is the master authority. The Intermediate CA is a sub-authority signed by the root. In real PKI, the root key is kept offline (very secure) and only the intermediate is used day-to-day. If the intermediate is compromised, the root can revoke it and create a new one without replacing the root.' },
          { q: 'Why does country need to be 2 letters?', a: 'It\'s an X.509 standard requirement. Use ISO 3166-1 alpha-2 codes: IN for India, US for United States, GB for United Kingdom, DE for Germany, etc.' },
          { q: 'What happens when I revoke a certificate?', a: 'The certificate is added to the CRL (Certificate Revocation List). Anyone who verifies that certificate will now get an "Invalid — revoked" result. The certificate file still exists but is no longer trusted.' },
          { q: 'What does the scheduler do?', a: 'A background job runs every 24 hours. It checks all active certificates against their policies. If auto-renew is on and a cert is expiring soon, it automatically revokes the old cert and issues a new one with the same identity.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem' }}>Q: {q}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.86rem', lineHeight: 1.7 }}>A: {a}</div>
          </div>
        ))}
      </Section>

    </div>
  )
}

function Section({ Icon, title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>
        <Icon size={16} color='#a78bfa' />
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

const codeStyle = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.82rem',
  background: 'rgba(255,255,255,0.07)',
  padding: '2px 6px',
  borderRadius: '4px',
  color: '#67e8f9',
}
