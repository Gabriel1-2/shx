"use client";

import { Scale, AlertTriangle, ShieldCheck, Ban, DollarSign, FileText, Gavel, Mail } from "lucide-react";

const LAST_UPDATED = "May 29, 2026";

function Section({ id, title, children, icon: Icon }: { id: string; title: string; children: React.ReactNode; icon: any }) {
    return (
        <div id={id} className="mb-10 scroll-mt-24">
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

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-background relative overflow-hidden pb-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10 px-4 md:px-8 pt-8 md:pt-16">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
                        <Scale size={14} />
                        LEGAL
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Terms of Service</h1>
                    <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
                </div>

                <div className="bg-black/60 border border-white/10 rounded-2xl backdrop-blur-xl p-6 md:p-10">
                    <Section id="acceptance" title="1. Acceptance of Terms" icon={FileText}>
                        <p>By accessing or using Shulevitz Exchange (&quot;SHX,&quot; &quot;the Platform&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to all terms, do not use the Platform.</p>
                        <p>SHX is a <strong className="text-white">non-custodial decentralized exchange aggregator</strong> built on the Solana blockchain. We provide a software interface for interacting with decentralized protocols. We do not hold, manage, or control any user funds or digital assets at any time.</p>
                    </Section>

                    <Section id="eligibility" title="2. Eligibility" icon={ShieldCheck}>
                        <p>You must be at least 18 years of age and legally able to enter into a binding agreement in your jurisdiction. By using SHX, you represent and warrant that:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>You are of legal age in your jurisdiction</li>
                            <li>You are not located in a jurisdiction where cryptocurrency trading is prohibited</li>
                            <li>You are not on any sanctions list (OFAC, EU, UN, etc.)</li>
                            <li>You will comply with all applicable local laws and regulations</li>
                        </ul>
                    </Section>

                    <Section id="platform" title="3. Platform Description" icon={FileText}>
                        <p>SHX provides the following services:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">Token Swaps:</strong> Executed via Jupiter aggregator on the Solana blockchain</li>
                            <li><strong className="text-white">Pro Trading Terminal:</strong> Real-time charts, order book, and market data</li>
                            <li><strong className="text-white">Fiat On-Ramp:</strong> Powered by third-party providers (MoonPay, Stripe)</li>
                            <li><strong className="text-white">Liquidity Farming:</strong> Interface for Raydium LP provisioning</li>
                            <li><strong className="text-white">Leaderboard &amp; Rewards:</strong> XP and rank system based on trading activity</li>
                            <li><strong className="text-white">Agent API:</strong> Programmatic access for institutional and bot traders</li>
                        </ul>
                        <p>All swaps are executed directly on-chain through Jupiter. SHX acts solely as an interface layer.</p>
                    </Section>

                    <Section id="fees" title="4. Fees" icon={DollarSign}>
                        <p>SHX charges a platform fee on each swap transaction. The fee rate depends on your Shulevitz token holdings:</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono mt-2">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-2 text-muted-foreground font-normal">Tier</th>
                                        <th className="text-left py-2 text-muted-foreground font-normal">Min SHX</th>
                                        <th className="text-left py-2 text-muted-foreground font-normal">Fee Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="text-white">
                                    <tr className="border-b border-white/5"><td className="py-1.5">Base</td><td>0</td><td>0.65%</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-1.5">Silver</td><td>10,000</td><td>0.60%</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-1.5">Gold</td><td>50,000</td><td>0.55%</td></tr>
                                    <tr className="border-b border-white/5"><td className="py-1.5">Platinum</td><td>100,000</td><td>0.52%</td></tr>
                                    <tr><td className="py-1.5">Diamond</td><td>500,000</td><td>0.50%</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3">Purchasing Shulevitz token on the platform incurs a <strong className="text-primary">0% platform fee</strong>. Network gas fees (Solana transaction fees) still apply and are not controlled by SHX.</p>
                    </Section>

                    <Section id="risks" title="5. Risks" icon={AlertTriangle}>
                        <p className="text-yellow-400 font-bold">IMPORTANT: Cryptocurrency trading involves substantial risk of loss.</p>
                        <p>By using SHX, you acknowledge and accept the following risks:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-white">Market Volatility:</strong> Cryptocurrency prices can fluctuate dramatically in short periods</li>
                            <li><strong className="text-white">Smart Contract Risk:</strong> Bugs or exploits in underlying protocols could result in loss of funds</li>
                            <li><strong className="text-white">Impermanent Loss:</strong> Liquidity providers may experience impermanent loss</li>
                            <li><strong className="text-white">Slippage:</strong> Actual execution price may differ from quoted price</li>
                            <li><strong className="text-white">Regulatory Risk:</strong> Cryptocurrency regulations may change in your jurisdiction</li>
                            <li><strong className="text-white">Wallet Security:</strong> You are solely responsible for securing your wallet and private keys</li>
                            <li><strong className="text-white">Irreversible Transactions:</strong> Blockchain transactions cannot be reversed once confirmed</li>
                        </ul>
                        <p><strong className="text-white">SHX does not provide financial, investment, legal, or tax advice.</strong> Past performance is not indicative of future results.</p>
                    </Section>

                    <Section id="prohibited" title="6. Prohibited Activities" icon={Ban}>
                        <p>The following activities are strictly prohibited on SHX:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Wash trading or any form of market manipulation</li>
                            <li>Using the platform for money laundering or terrorism financing</li>
                            <li>Exploiting platform vulnerabilities or bugs</li>
                            <li>Interfering with other users&apos; access to the platform</li>
                            <li>Using automated tools to abuse the leaderboard or rewards system</li>
                            <li>Accessing the platform from sanctioned jurisdictions</li>
                            <li>Any activity that violates applicable laws or regulations</li>
                        </ul>
                        <p>We reserve the right to restrict access to the platform for any user engaging in prohibited activities.</p>
                    </Section>

                    <Section id="liability" title="7. Limitation of Liability" icon={Gavel}>
                        <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SHX AND ITS FOUNDERS, DEVELOPERS, AND AFFILIATES SHALL NOT BE LIABLE FOR:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Any direct, indirect, incidental, special, consequential, or punitive damages</li>
                            <li>Loss of profits, data, or digital assets</li>
                            <li>Errors or interruptions in service</li>
                            <li>Actions of third-party protocols (Jupiter, Raydium, MoonPay, Stripe)</li>
                            <li>Unauthorized access to your wallet</li>
                        </ul>
                        <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED.</p>
                    </Section>

                    <Section id="ip" title="8. Intellectual Property" icon={ShieldCheck}>
                        <p>All content, branding, design, and code of the SHX platform are the property of Shulevitz Exchange. You may not copy, modify, distribute, or create derivative works without prior written consent.</p>
                    </Section>

                    <Section id="governing" title="9. Governing Law" icon={Scale}>
                        <p>These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms shall be resolved through binding arbitration in accordance with applicable arbitration rules.</p>
                    </Section>

                    <Section id="modifications" title="10. Modifications" icon={FileText}>
                        <p>We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated date. Your continued use of the Platform after changes constitutes acceptance of the modified Terms.</p>
                    </Section>

                    <Section id="contact" title="11. Contact" icon={Mail}>
                        <p>For questions about these Terms of Service, contact:</p>
                        <p className="font-mono text-primary">team@shulevitz.exchange</p>
                    </Section>
                </div>
            </div>
        </main>
    );
}
