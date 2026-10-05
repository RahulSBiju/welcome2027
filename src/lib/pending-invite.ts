import AsyncStorage from '@react-native-async-storage/async-storage';

// When someone opens an invite link before signing in, we remember the code here
// and join the trip automatically right after they sign in.
const KEY = 'pendingInviteCode';

export async function savePendingInvite(code: string) {
  await AsyncStorage.setItem(KEY, code);
}

export async function takePendingInvite() {
  const code = await AsyncStorage.getItem(KEY);
  if (code) await AsyncStorage.removeItem(KEY);
  return code;
}

export async function peekPendingInvite() {
  return AsyncStorage.getItem(KEY);
}
