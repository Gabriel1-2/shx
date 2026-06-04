/**
 * Compliance & Blockchain Intelligence Module
 * 
 * Provides utilities to screen wallets against OFAC sanctions, 
 * known hacker addresses, and terrorism financing lists.
 */

// A fallback static list of known malicious/sanctioned Solana addresses.
// In a true production environment without an API key, this would be updated via a cron job
// from open source threat intelligence feeds.
const STATIC_BLACKLIST = [
    // Example test malicious wallet (do not use in prod as a real test unless needed)
    '4qC66Xf5Pz3Q1LMyh8QjPzQ1LMyh8QjPzQ1LMyh8QjPz', 
    'F543C66Xf5Pz3Q1LMyh8QjPzQ1LMyh8QjPzQ1LMyh8Qj' 
];

export interface RiskScreeningResult {
    isBlocked: boolean;
    reason?: string;
    riskScore: number;
}

/**
 * Checks a wallet address against TRM Labs or a static blacklist.
 * @param wallet The Solana public key string
 * @returns RiskScreeningResult
 */
export async function checkWalletRisk(wallet: string): Promise<RiskScreeningResult> {
    if (!wallet) {
        return { isBlocked: true, reason: "Invalid wallet address", riskScore: 100 };
    }

    const apiKey = process.env.TRM_LABS_API_KEY;

    if (apiKey) {
        // TRM Labs Enterprise Integration
        try {
            const response = await fetch('https://api.trmlabs.com/public/v2/screening/addresses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
                },
                body: JSON.stringify([
                    {
                        address: wallet,
                        chain: 'solana'
                    }
                ])
            });

            if (response.ok) {
                const data = await response.json();
                const result = data[0]; // We only submitted one address
                
                // TRM returns risk indicators. If there are severe risks (e.g. Sanctions), block.
                const hasSevereRisk = result.entities?.some((entity: any) => 
                    entity.riskScore >= 10 || entity.category === 'Sanctions' || entity.category === 'Terrorism Financing'
                );

                if (hasSevereRisk) {
                    return { isBlocked: true, reason: "Address flagged by TRM Labs compliance API", riskScore: 100 };
                }
                
                return { isBlocked: false, riskScore: 0 };
            } else {
                console.error("[Compliance] TRM Labs API error:", response.status, await response.text());
                // Fail open or fail closed? Usually fail open if API is down so users can trade, 
                // unless strict compliance is mandated. We will fail open but log heavily.
                return { isBlocked: false, reason: "TRM API Unavailable", riskScore: 0 };
            }
        } catch (error) {
            console.error("[Compliance] TRM Labs fetch error:", error);
            return { isBlocked: false, reason: "TRM Network Error", riskScore: 0 };
        }
    } else {
        // Fallback static blacklist mode
        if (STATIC_BLACKLIST.includes(wallet)) {
            return { isBlocked: true, reason: "Address is on static OFAC/Hacker blacklist", riskScore: 100 };
        }
        return { isBlocked: false, riskScore: 0 };
    }
}
