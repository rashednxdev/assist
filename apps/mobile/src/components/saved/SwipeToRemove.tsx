import { useRef, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  confirmTitle?: string;
  confirmMessage?: string;
  onConfirmRemove: () => void | Promise<void>;
};

export function SwipeToRemove({
  children,
  confirmTitle = 'Remove saved item?',
  confirmMessage = 'This will remove it from your Saved list on this device.',
  onConfirmRemove,
}: Props) {
  const ref = useRef<Swipeable>(null);
  const prompted = useRef(false);

  function requestRemove() {
    if (prompted.current) return;
    prompted.current = true;
    Alert.alert(confirmTitle, confirmMessage, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          prompted.current = false;
          ref.current?.close();
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          prompted.current = false;
          void onConfirmRemove();
          ref.current?.close();
        },
      },
    ]);
  }

  return (
    <Swipeable
      ref={ref}
      overshootRight={false}
      friction={2}
      rightThreshold={48}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') requestRemove();
      }}
      onSwipeableClose={() => {
        prompted.current = false;
      }}
      renderRightActions={() => (
        <Pressable style={styles.action} onPress={requestRemove}>
          <Text style={styles.actionText}>Remove</Text>
        </Pressable>
      )}
    >
      <View style={styles.child}>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  child: {
    backgroundColor: 'transparent',
  },
  action: {
    width: 88,
    marginLeft: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
