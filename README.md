# SHX Exchange 🦍🚀

**The Professional Trader's Interface on Solana.**

SHX Exchange is a high-performance, non-custodial trading terminal built for speed, transparency, and community rewards. Powered by **Jupiter "Ultra" Routing**, it offers the best prices on Solana with a unique gamified incentive layer.

![SHX Dashboard](https://github.com/Gabriel1-2/shx/assets/placeholder-image.png)

## 🔥 Key Features

### 1. Pro Terminal

* **Jupiter Ultra swaps** with best-route aggregation.
* **Limit orders** via Jupiter Trigger V2 (vault deposit + price triggers).
* **DCA** via Jupiter Recurring (time-based auto-buys).
* **0% platform fee** when buying $SHULEVITZ (SHX).

### 2. Tiered Fee System 📉

Trade cheaper by holding **$SHULEVITZ**. Fees are calculated dynamically on every swap.

| $SHULEVITZ Holdings | Fee Rate | Discount vs Base |
|---------------------|----------|------------------|
| $0                  | 0.65%    | —                |
| 10,000+             | 0.60%    | ~7.7% OFF        |
| 50,000+             | 0.55%    | ~15.4% OFF       |
| 100,000+            | 0.52%    | ~20% OFF         |
| **500,000+**        | **0.50%**| **~23% OFF**     |

### 3. Volume Rewards & Leaderboard 🏆

* **XP System:** Earn XP for every dollar traded.
* **Weekly leaderboard:** Top 10 by fees paid (min $10 weekly fees), **$250** pool.
* **Transparency:** Verify global volume and fees on the dashboard.
* **Referrals:** Share `?ref=CODE` — earn 10% of referred traders' fees.

---

## 🛠 Tech Stack

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Styling:** [Tailwind CSS v3](https://tailwindcss.com/)
* **Swap Engine:** [Jupiter Terminal](https://terminal.jup.ag/)
* **Backend / DB:** Google Firestore (Firebase)
* **Wallet Adapter:** Solana Wallet Adapter (Phantom, Solflare, Backpack)

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* npm

### Installation

1. **Clone the repo**

    ```bash
    git clone https://github.com/Gabriel1-2/shx.git
    cd shx
    ```

2. **Install dependencies**

    ```bash
    npm install
    # or
    npm i --legacy-peer-deps
    ```

3. **Run Development Server**

    ```bash
    npm run dev
    ```

4. Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Deployment

This project is optimized for **Vercel**.

1. Push to GitHub.
2. Import project in Vercel.
3. Deploy.

*(No complex Environment Variables required for the public MVP).*

---

## 🛡 Security

* **Non-Custodial:** We never touch user funds. All swaps are routed directly through Jupiter smart contracts.
* **Open Source:** Verify the codebase on GitHub.
* **Firebase:** Data tracked via secure Google Cloud Firestore.

---

Built by the **SHX Community**.
