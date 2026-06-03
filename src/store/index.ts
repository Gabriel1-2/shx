import { create } from "zustand";
import { SHULEVITZ_MINT } from "@/lib/constants";

interface GlobalState {
    isChartVisible: boolean;
    setChartVisible: (visible: boolean) => void;
    toggleChartVisible: () => void;

    chartToken: { address: string; symbol: string };
    setChartToken: (token: { address: string; symbol: string }) => void;
}

export const useStore = create<GlobalState>((set) => ({
    isChartVisible: false,
    setChartVisible: (visible) => set({ isChartVisible: visible }),
    toggleChartVisible: () => set((state) => ({ isChartVisible: !state.isChartVisible })),

    chartToken: { address: SHULEVITZ_MINT, symbol: "SHX" },
    setChartToken: (token) => set({ chartToken: token }),
}));
