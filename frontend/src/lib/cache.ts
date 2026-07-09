import AsyncStorage from "@react-native-async-storage/async-storage";

export const cache = {
  set: async (key: string, data: any, ttlMs?: number): Promise<void> => {
    try {
      const payload = {
        data,
        expiry: ttlMs ? Date.now() + ttlMs : null,
      };
      await AsyncStorage.setItem(`oncampus_cache_${key}`, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to set cache for", key, e);
    }
  },

  get: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(`oncampus_cache_${key}`);
      if (!raw) return null;
      
      const payload = JSON.parse(raw);
      if (payload.expiry && Date.now() > payload.expiry) {
        // Cache expired
        await AsyncStorage.removeItem(`oncampus_cache_${key}`);
        return null;
      }
      
      return payload.data as T;
    } catch (e) {
      console.warn("Failed to get cache for", key, e);
      return null;
    }
  },

  clear: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(`oncampus_cache_${key}`);
    } catch (e) {
      console.warn("Failed to clear cache for", key, e);
    }
  },

  clearAll: async (): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith("oncampus_cache_"));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (e) {
      console.warn("Failed to clear all cache", e);
    }
  },
};
