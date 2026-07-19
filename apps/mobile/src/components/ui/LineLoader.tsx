import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme';

const BAR_WIDTH_RATIO = 0.35;
const SWEEP_DURATION_MS = 900;

/** Simple indeterminate left-to-right progress bar — a short highlight sweeping across a track. */
export function LineLoader() {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackWidth <= 0) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [trackWidth, progress]);

  const barWidth = trackWidth * BAR_WIDTH_RATIO;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, trackWidth],
  });

  function onLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.track} onLayout={onLayout}>
      {trackWidth > 0 ? (
        <Animated.View style={[styles.bar, { width: barWidth, transform: [{ translateX }] }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    overflow: 'hidden',
  },
  bar: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
