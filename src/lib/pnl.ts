export interface Trade {
    id: string;
    timestamp: number;
    inputMint: string;
    outputMint: string;
    inAmount: number;
    outAmount: number;
    pointsEarned: number;
    txHash: string;
}

const STORAGE_KEY = "shx_trades";

export const PnlService = {
    getTrades: (): Trade[] => {
        if (typeof window === "undefined") return [];
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    addTrade: (trade: Trade) => {
        const trades = PnlService.getTrades();
        trades.push(trade);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    },

    getStats: () => {
        const trades = PnlService.getTrades();
        const totalVolume = trades.reduce((acc, t) => acc + t.inAmount, 0); // Simplified: assuming input is always SOL or normalized in future
        const totalPoints = trades.reduce((acc, t) => acc + t.pointsEarned, 0);
        return {
            totalTrades: trades.length,
            totalVolume, // In SOL for MVP
            totalPoints
        };
    }
};
