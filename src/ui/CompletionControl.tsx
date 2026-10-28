import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text } from "react-native";
import { successFeedback } from "../platform/haptics";
export function CompletionControl({
  completed,
  label,
  reduced,
  onComplete,
}: {
  completed: boolean;
  label: string;
  reduced: boolean;
  onComplete: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false),
    [scale] = useState(() => new Animated.Value(1)),
    lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      scale.stopAnimation();
    };
  }, [scale]);
  async function press() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    successFeedback();
    if (!reduced)
      await new Promise<void>((resolve) =>
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.9,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]).start(() => resolve()),
      );
    if (!alive.current) return;
    await onComplete();
    if (alive.current) {
      setPending(false);
      lock.current = false;
    }
  }
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: completed || pending, disabled: pending }}
      disabled={pending}
      onPress={() => void press()}
      style={{
        width: 44,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: 25,
          height: 25,
          borderWidth: 1.5,
          borderColor: "#5D47D9",
          backgroundColor: completed || pending ? "#E5DEFF" : "transparent",
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        <Text style={{ color: "#5D47D9", fontSize: 18 }}>
          {completed || pending ? "✓" : ""}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
