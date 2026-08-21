import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { colors } from '@/theme';

export default function AppLayout() {
  const { user, loading } = useAuth();

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
      <Stack.Screen name="history" />
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
      <Stack.Screen name="exam-week" />
      <Stack.Screen name="live" />
      <Stack.Screen name="users" />
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
