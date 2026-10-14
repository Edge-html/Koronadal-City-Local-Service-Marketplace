/**
 * Commission model.
 *
 * The platform operates as a non-custodial framework. The household pays 100%
 * of the quote straight to the worker in cash or GCash. To fund that 10%
 * commission without ever handling client funds, the worker maintains a
 * prepaid platform balance: the commission is locked at quote approval and
 * deducted on job completion.
 *
 *   commission = laborFee * 0.10   (materials are a pass-through: 0%)
 *
 * There is deliberately no `commissionOnMaterials`: material cost carries no
 * commission, so passing it anywhere would be a bug rather than a default.
 */

export const COMMISSION_RATE = 0.1;

/** Currency amount rounded to the nearest peso, guarding float drift. */
export function pesos(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** The 10% platform commission, calculated strictly on the labor portion. */
export function commissionOn(laborFee: number): number {
  return pesos(laborFee * COMMISSION_RATE);
}

export interface QuoteTotals {
  laborFee: number;
  materialsCost: number;
  /** laborFee + materialsCost — what the consumer actually hands over. */
  total: number;
  /** 10% of laborFee — the amount locked from the worker's wallet. */
  commission: number;
  /** laborFee - commission — what the worker effectively retains in the ledger. */
  workerNet: number;
  /** True when the quote falls below the category's monitored price floor. */
  belowFloor: boolean;
}

export function computeTotals(
  laborFee: number,
  materialsCost: number,
  floor = 0,
): QuoteTotals {
  const labor = Math.max(0, pesos(laborFee || 0));
  const materials = Math.max(0, pesos(materialsCost || 0));
  const commission = commissionOn(labor);
  return {
    laborFee: labor,
    materialsCost: materials,
    total: pesos(labor + materials),
    commission,
    workerNet: pesos(labor - commission),
    belowFloor: labor > 0 && labor < floor,
  };
}

/**
 * A worker's wallet drops below ₱0 when commission settlements exceed the
 * prepaid balance; at that point they are paused from receiving new requests
 * until they reload.
 */
export function isWalletBreached(availableBalance: number): boolean {
  return availableBalance < 0;
}

/** Available balance = prepaid funds minus any commission currently locked. */
export function availableBalance(walletBalance: number, walletLocked: number) {
  return pesos(walletBalance - walletLocked);
}

export function formatPeso(value: number): string {
  const rounded = pesos(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}₱${Math.abs(rounded).toLocaleString("en-PH", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export const WALLET_LOCK_THRESHOLD = 100;

/**
 * A worker must hold at least this much commission coverage in their prepaid
 * balance to be shown in the browse directory. Keeps the marketplace from
 * filling with workers who cannot settle.
 */
export function hasWalletCoverage(balance: number): boolean {
  return balance >= WALLET_LOCK_THRESHOLD;
}