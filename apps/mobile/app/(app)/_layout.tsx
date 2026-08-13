import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { syncQuestions } from '@/lib/questions-sync';
import { getCachedQuestionCount } from '@/lib/questions-db';
import { questionCacheScopeKey } from '@/lib/subject-scope';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { colors } from '@/theme';

export default function AppLayout() {
  const { user, loading } = useAuth();

  // Warm the local question cache as soon as a session is active. If the bank is empty
  // (fresh login/register or cleared cache), kick sync immediately in the background.
  useEffect(() => {
    if (!user) return;
    const scopeKey = questionCacheScopeKey(user);
    if (getCachedQuestionCount() === 0) {
      void syncQuestions(scopeKey);
      return;
    }
    void syncQuestions(scopeKey);
  }, [user?.id, user?.all_exam_subjects, user?.exam_subject_ids]);

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
