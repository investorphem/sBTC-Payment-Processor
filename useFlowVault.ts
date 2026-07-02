import { useCallback, useState } from 'react';
import {
  setVaultRoutingRules,
  clearVaultRoutingRules,
  depositToVault,
  withdrawFromVault,
  getVaultState,
  getVaultRoutingRules,
  vaultHasLockedFunds,
  getVaultCurrentBlockHeight,
  describeFlowVaultError,
  RoutingRuleParams,
} from '../lib/flowvault';

/**
 * Wraps FlowVault SDK read/write calls with React state, loading flags,
 * and user-facing error messages, for a single connected merchant address.
 */
export function useFlowVault(address: string | null) {
  const [vaultState, setVaultStateValue] = useState<any>(null);
  const [routingRules, setRoutingRulesValue] = useState<any>(null);
  const [hasLocked, setHasLocked] = useState(false);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [state, rules, locked, height] = await Promise.all([
        getVaultState(address),
        getVaultRoutingRules(address),
        vaultHasLockedFunds(address),
        getVaultCurrentBlockHeight(address),
      ]);
      setVaultStateValue(state);
      setRoutingRulesValue(rules);
      setHasLocked(Boolean(locked));
      setBlockHeight(typeof height === 'number' ? height : null);
    } catch (err: any) {
      setError(describeFlowVaultError(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  const saveRoutingRules = useCallback(async (params: RoutingRuleParams) => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await setVaultRoutingRules(address, params);
      await refresh();
      return result;
    } catch (err: any) {
      setError(describeFlowVaultError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refresh]);

  const clearRules = useCallback(async () => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await clearVaultRoutingRules(address);
      await refresh();
      return result;
    } catch (err: any) {
      setError(describeFlowVaultError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refresh]);

  const deposit = useCallback(async (amount: string) => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await depositToVault(address, amount);
      await refresh();
      return result;
    } catch (err: any) {
      setError(describeFlowVaultError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refresh]);

  const withdraw = useCallback(async (amount: string) => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await withdrawFromVault(address, amount);
      await refresh();
      return result;
    } catch (err: any) {
      setError(describeFlowVaultError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, refresh]);

  return {
    vaultState,
    routingRules,
    hasLocked,
    blockHeight,
    loading,
    error,
    refresh,
    saveRoutingRules,
    clearRules,
    deposit,
    withdraw,
  };
}
