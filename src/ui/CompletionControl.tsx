import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { successFeedback } from "../platform/haptics";
import { c } from "./theme";
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
          width: 24,
          height: 24,
          borderWidth: 2,
          borderColor: completed || pending ? c.blue : "#B9C6DB",
          backgroundColor: completed || pending ? c.blue : "transparent",
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        {(completed || pending) && (
          <Ionicons name="checkmark" size={15} color={c.white} />
        )}
      </Animated.View>
    </Pressable>
  );
}
