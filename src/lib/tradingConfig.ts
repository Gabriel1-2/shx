/**
 * Trading configuration — centralized kill switch for all trading features.
 * 
 * Set TRADING_ENABLED to false to pause all trading (swaps, limits, DCAs)
 * across the entire platform. The UI will show a maintenance overlay
 * instead of the trading panels.
 * 
 * This flag is checked client-side for the UI overlay AND server-side
 * in all trading API routes as a safety net.
 */

export const TRADING_ENABLED = false;

export const MAINTENANCE_MESSAGE = "Trading is temporarily paused while we verify system stability. Check back soon!";
