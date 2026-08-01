import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { syncQuestions } from '@/lib/questions-sync';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { colors } from '@/theme';

export default function AppLayout() {
  const { user, loading } = useAuth();

  // Warm the local question cache as soon as a session is active, so Question Bank / Marathon
  // are already up to date by the time the user opens them.
  useEffect(() => {
    if (!user) return;
    void syncQuestions();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void registerForPushNotifications();
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: 'Profile',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen
        name="progress"
        options={{
          headerShown: true,
          title: 'Progress Dashboard',
          headerBackTitle: 'Home',
        }}
      />
      <Stack.Screen name="saved" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="books" />
      <Stack.Screen name="questions" />
      <Stack.Screen name="marathon" />
      <Stack.Screen name="exams" />
      <Stack.Screen name="papers" />
      <Stack.Screen name="pension" />
      <Stack.Screen name="joining-period" />
      <Stack.Screen name="qotd" />
      <Stack.Screen name="exam-routine" />
      <Stack.Screen name="user-questions" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
