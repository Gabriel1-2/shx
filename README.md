# SHX Exchange 🦍🚀

**The Professional Trader's Interface on Solana.**

SHX Exchange is a high-performance, non-custodial trading terminal built for speed, transparency, and community rewards. Powered by **Jupiter "Ultra" Routing**, it offers the best prices on Solana with a unique gamified incentive layer.

![SHX Dashboard](https://github.com/Gabriel1-2/shx/assets/placeholder-image.png)

## 🔥 Key Features

### 1. Pro Terminal

* **Integrated Jupiter V2:** Access the deepest liquidity on Solana.
* **"Ape Mode" 🦍:** One-click toggle for **High Slippage (1%)** and **Priority Fees** to snipe launches instantly.
* **0% Fee Promo:** Buy $SHULEVITZ with 0% trading fees.

### 2. Tiered Fee System 📉

Trade cheaper by holding **$SHULEVITZ**. Fees are calculated dynamically on every swap.

| $SHULEVITZ Holdings | Fee Rate | Discount |
|---------------------|----------|----------|
| $0                  | 0.50%    | —        |
| $7,500+             | 0.25%    | 50% OFF  |
| $300,000+           | 0.06%    | 88% OFF  |
| **$750,000+**       | **0.05%**| **MAX**  |

### 3. Volume Rewards & Leaderboard 🏆

* **XP System:** Earn XP for every dollar traded.
* **Live Leaderboard:** Track the top volume traders in real-time.
* **Daily Rewards:** Top 10 traders unlock cash rewards and reduced fees for the next day.
* **Transparency:** Verify Global Volume and Fees Paid directly on the dashboard.

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
