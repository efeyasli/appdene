import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { Tab } from "../domain/selectors";
import { s } from "./styles";

const tabs: Tab[] = ["Bugün", "Yaklaşan", "Sonra"];

// Respect the system preference, including changes while the app is open.
export const MotionContext = createContext<boolean | undefined>(undefined);
export function useReducedMotion(override = false) {
  const preference = useContext(MotionContext);
  const [reduced, setReduced] = useState(preference ?? true);
  useEffect(() => {
    if (preference !== undefined) return;
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduced(value);
      })
      .catch(() => {
        /* Keep motion disabled if the system preference is unavailable. */
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [preference]);
  return (preference ?? reduced) || override;
}

export function TaskTabs({
  selected,
  onSelect,
  reducedMotion,
}: {
  selected: Tab;
  onSelect: (tab: Tab) => void;
  reducedMotion: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [position] = useState(() => new Animated.Value(0));
  useLayoutEffect(() => {
    position.stopAnimation();
    const target = (tabs.indexOf(selected) * width) / tabs.length;
    if (reducedMotion || width === 0) {
      position.setValue(target);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: target,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, width, reducedMotion, position]);

  return (
    <View style={s.tabs}>
      <View
        style={s.tabTrack}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.tabIndicator,
              {
                width: width / tabs.length,
                transform: [{ translateX: position }],
              },
            ]}
          />
        )}
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === tab }}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => [s.tab, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text
              style={{
                color: selected === tab ? "#18105B" : "#FFFFFF",
                fontWeight: "600",
              }}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TaskListTransition({
  tab,
  reducedMotion,
  children,
}: {
  tab: Tab;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(1));
  const [translation] = useState(() => new Animated.Value(0));
  const previous = useRef(tab);
  useLayoutEffect(() => {
    progress.stopAnimation();
    translation.stopAnimation();
    const old = previous.current;
    previous.current = tab;
    if (reducedMotion || old === tab) {
      progress.setValue(1);
      translation.setValue(0);
      return;
    }
    const direction = tabs.indexOf(tab) > tabs.indexOf(old) ? 1 : -1;
    translation.setValue(direction * 10);
    progress.setValue(0);
    const config = {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    };
    const animation = Animated.parallel([
      Animated.timing(progress, config),
      Animated.timing(translation, { ...config, toValue: 0 }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [tab, reducedMotion, progress, translation]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateX: translation,
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
