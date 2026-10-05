import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider, useSession } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();

  // Keep the splash screen up until we know whether someone is signed in.
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" options={{ title: 'My Trips' }} />
        <Stack.Screen name="trip/[id]/index" options={{ title: 'Trip' }} />
        <Stack.Screen name="trip/[id]/places" options={{ title: 'Places' }} />
        <Stack.Screen name="trip/[id]/place/[placeId]" options={{ title: 'Place' }} />
        <Stack.Screen name="trip/[id]/discussion" options={{ title: 'Group chat' }} />
        <Stack.Screen name="trip/[id]/packing" options={{ title: 'Packing list' }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* These work whether or not you're signed in. */}
      <Stack.Screen name="join/[code]" options={{ title: 'Join trip', headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password', headerShown: false }} />
    </Stack>
  );
}
