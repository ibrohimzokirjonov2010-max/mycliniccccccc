import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let active = true;
    const read = (connected: boolean | null | undefined) => {
      if (active) setOnline(connected !== false);
    };
    Network.getNetworkStateAsync().then((state) => read(state.isConnected)).catch(() => read(true));
    const subscription = Network.addNetworkStateListener((state) => read(state.isConnected));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return online;
}
