"use client";

import { FileText, Shield, Eye, Database, Globe, Mail, Calendar } from "lucide-react";

const LAST_UPDATED = "May 29, 2026";

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: any }) {
    return (
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                    <Icon size={16} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3 pl-11">{children}</div>
        </div>
    );
}

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10 px-4 md:px-8 pt-8 md:pt-16">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
                        <Shield size={14} />
                        LEGAL
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Privacy Policy</h1>
                    <p className="text-muted-foreground text-sm">
                        Last updated: {LAST_UPDATED}
                    </p>
                </div>

                <div className="bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl p-6 md:p-10">
                    <Section title="Overview" icon={FileText}>
                        <p>Shulevitz Exchange (&quot;SHX,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a non-custodial decentralized exchange aggregator operating on the Solana blockchain. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at shx.exchange.</p>
                        <p><strong className="text-white">We do not custody, hold, or control any user funds, private keys, or seed phrases at any time.</strong></p>
                    </Section>

                    <Section title="Information We Collect" icon={Database}>
                        <p><strong className="text-white">Public Blockchain Data:</strong> When you connect your wallet and execute transactions, we read your public wallet address and on-chain transaction data. This data is inherently public on the Solana blockchain.</p>
                        <p><strong className="text-white">Platform Usage Data:</strong> We store the following in Firebase Firestore to power our leaderboard and fee tier system:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Public wallet addresses</li>
                            <li>Aggregated trading volume (USD)</li>
                            <li>Trade count and fee history</li>
                            <li>Referral codes and referral relationships</li>
                            <li>XP points and leaderboard rankings</li>
                            <li>Favorite token selections</li>
                        </ul>
                        <p><strong className="text-white">Analytics:</strong> We use Google Analytics (via Firebase) to collect anonymous usage data including page views, session duration, and device type. This data cannot be used to personally identify you.</p>
                        <p><strong className="text-white">What We Do NOT Collect:</strong></p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Private keys or seed phrases</li>
                            <li>Personal identification documents</li>
                            <li>Email addresses (unless voluntarily provided)</li>
                            <li>IP addresses for tracking purposes</li>
                            <li>Financial account information</li>
                        </ul>
                    </Section>

                    <Section title="How We Use Your Information" icon={Eye}>
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Determine your fee tier based on Shulevitz token holdings</li>
                            <li>Display your trading statistics and leaderboard ranking</li>
                            <li>Track and distribute referral rewards</li>
                            <li>Display aggregate platform statistics (total volume, users, etc.)</li>
                            <li>Improve platform performance and user experience</li>
                        </ul>
                    </Section>

                    <Section title="Third-Party Services" icon={Globe}>
                        <p>Our platform integrates with the following third-party services:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">Jupiter Aggregator:</strong> Routes and executes swap transactions on Solana</li>
                            <li><strong className="text-white">DexScreener &amp; CoinGecko:</strong> Provides real-time market data and pricing</li>
                            <li><strong className="text-white">MoonPay &amp; Stripe:</strong> Processes fiat-to-crypto purchases (subject to their own privacy policies and KYC requirements)</li>
                            <li><strong className="text-white">Raydium:</strong> Provides liquidity pool infrastructure</li>
                            <li><strong className="text-white">Firebase (Google):</strong> Database and analytics services</li>
                            <li><strong className="text-white">Helius:</strong> Solana RPC infrastructure</li>
                        </ul>
                        <p>Each third-party service operates under its own privacy policy. We encourage you to review them.</p>
                    </Section>

                    <Section title="Data Retention & Deletion" icon={Calendar}>
                        <p>We retain platform usage data for as long as your wallet remains active on the platform. Since all data is keyed by your public wallet address (not personal identity), you may effectively &quot;delete&quot; your data by discontinuing use of the platform.</p>
                        <p>To request deletion of your Firestore records, contact us at the email below. On-chain transaction data cannot be deleted as it is immutably stored on the Solana blockchain.</p>
                    </Section>

                    <Section title="Your Rights (GDPR / CCPA)" icon={Shield}>
                        <p>Depending on your jurisdiction, you may have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Access the data we hold about your wallet address</li>
                            <li>Request correction of inaccurate data</li>
                            <li>Request deletion of your platform data</li>
                            <li>Object to or restrict processing of your data</li>
                            <li>Data portability</li>
                        </ul>
                        <p>California residents: Under the CCPA, you have the right to know what personal information is collected, request deletion, and opt out of the sale of personal information. <strong className="text-white">We do not sell any personal information.</strong></p>
                    </Section>

                    <Section title="Age Requirement" icon={Shield}>
                        <p>You must be at least 18 years of age to use SHX Exchange. We do not knowingly collect information from individuals under 18.</p>
                    </Section>

                    <Section title="Changes to This Policy" icon={FileText}>
                        <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the platform after changes constitutes acceptance of the revised policy.</p>
                    </Section>

                    <Section title="Contact Us" icon={Mail}>
                        <p>If you have questions about this Privacy Policy, please contact us at:</p>
                        <p className="font-mono text-primary">team@shulevitz.exchange</p>
                    </Section>
                </div>
            </div>
        </main>
    );
}
