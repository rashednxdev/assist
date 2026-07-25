import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

type KeyboardScrollContextValue = {
  scrollRef: RefObject<ScrollView | null>;
  /** Extra bottom padding so a covered field can scroll above the keyboard. */
  keyboardInset: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ensureVisible: (target: View | null) => void;
};

const KeyboardScrollContext = createContext<KeyboardScrollContextValue | null>(null);

const GAP = 20;

/**
 * `Dimensions.get('screen')` is the physical display size and does NOT change when the
 * keyboard opens — unlike `Dimensions.get('window')`, which on Android is only supposed to
 * shrink under `adjustResize` but in practice does not reliably update in JS (a long-standing
 * RN gap). Subtracting the keyboard's own reported height from the stable screen height gives
 * the visible-bottom threshold on both platforms without depending on that resize signal:
 * iOS keyboard overlays the window (no resize), Android's `adjustResize` shrinks the window by
 * ~keyboardHeight — either way `screenHeight - keyboardHeight` approximates the visible bottom.
 */
function visibleBottomY(keyboardHeight: number): number {
  const screenH = Dimensions.get('screen').height;
  return screenH - keyboardHeight - GAP;
}

export function KeyboardScrollProvider({ children }: { children: ReactNode }) {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const pendingTargetRef = useRef<View | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scrollIfCovered = useCallback((target: View | null) => {
    if (!target) return;
    const limit = visibleBottomY(keyboardHeightRef.current);
    target.measureInWindow((_x, y, _w, height) => {
      const fieldBottom = y + height;
      if (fieldBottom <= limit) return;
      const overlap = fieldBottom - limit;
      scrollRef.current?.scrollTo({
        y: Math.max(0, scrollYRef.current + overlap),
        animated: true,
      });
    });
  }, []);

  const scheduleEnsure = useCallback(
    (target: View | null) => {
      if (!target) return;
      pendingTargetRef.current = target;
      // Retry after layout / keyboard animation so the resize/reflow has settled.
      const delays = Platform.OS === 'ios' ? [50, 180, 320] : [80, 200, 360];
      for (const ms of delays) {
        setTimeout(() => {
          if (pendingTargetRef.current === target) {
            scrollIfCovered(target);
          }
        }, ms);
      }
    },
    [scrollIfCovered],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = height;
      // Room to scroll the focused field up without pushing the whole layout via KAV.
      setKeyboardInset(Platform.OS === 'ios' ? height : Math.max(120, Math.round(height * 0.35)));
      scheduleEnsure(pendingTargetRef.current);
    };
    const onHide = () => {
      keyboardHeightRef.current = 0;
      setKeyboardInset(0);
      pendingTargetRef.current = null;
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleEnsure]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const ensureVisible = useCallback(
    (target: View | null) => {
      scheduleEnsure(target);
    },
    [scheduleEnsure],
  );

  const value = useMemo(
    () => ({ scrollRef, keyboardInset, onScroll, ensureVisible }),
    [keyboardInset, onScroll, ensureVisible],
  );

  return (
    <KeyboardScrollContext.Provider value={value}>{children}</KeyboardScrollContext.Provider>
  );
}

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}
