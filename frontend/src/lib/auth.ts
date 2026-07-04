/**
 * Secure Authentication Utilities
 * Handles logout with complete session cleanup and navigation reset
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { clearSession, api } from './api';

/**
 * Secure logout function that:
 * 1. Invalidates tokens on server
 * 2. Clears all secure storage
 * 3. Clears AsyncStorage data
 * 4. Resets navigation stack to prevent back button
 */
export async function secureLogout(): Promise<void> {
  try {
    // Step 1: Call backend to invalidate tokens
    // This marks tokens as invalid in the database
    await api.auth.logout();
  } catch (error) {
    console.error('Server logout failed:', error);
    // Continue with client logout even if server fails
    // This ensures user can logout even with network issues
  }

  try {
    // Step 2: Clear secure storage (tokens)
    await clearSession();

    // Step 3: Clear all app data from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    const oncampusKeys = allKeys.filter((key) => key.startsWith('oncampus.'));
    if (oncampusKeys.length > 0) {
      await AsyncStorage.multiRemove(oncampusKeys);
    }

    // Step 4: Reset navigation stack completely
    // Using replace instead of push prevents back navigation
    // dismissAll clears the entire navigation history
    if (router.canDismiss()) {
      router.dismissAll();
    }
    
    // Navigate to welcome screen (auth flow)
    router.replace('/(auth)/welcome');
  } catch (error) {
    console.error('Client logout cleanup failed:', error);
    // Force navigate to auth even if cleanup fails
    router.replace('/(auth)/welcome');
  }
}

/**
 * Check if user is authenticated
 * Used by route guards to protect authenticated routes
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = await AsyncStorage.getItem('oncampus.access_token');
    return token !== null && token.length > 0;
  } catch {
    return false;
  }
}

/**
 * Force logout if token is invalid or expired
 * Used when API returns 401 Unauthorized
 */
export async function forceLogout(): Promise<void> {
  await clearSession();
  const allKeys = await AsyncStorage.getAllKeys();
  const oncampusKeys = allKeys.filter((key) => key.startsWith('oncampus.'));
  if (oncampusKeys.length > 0) {
    await AsyncStorage.multiRemove(oncampusKeys);
  }
  router.replace('/(auth)/welcome');
}
