import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "./TaskTabs";
import { s } from "./styles";
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions(),
    insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(height));
  const closing = useRef(false),
    latest = useRef({ onClose, height, reduced });
  useEffect(() => {
    latest.current = { onClose, height, reduced };
  }, [onClose, height, reduced]);
  useEffect(() => {
    // A slightly damped spring reads as a native sheet; no bounce past the top.
    const a = reduced
      ? Animated.timing(offset, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      : Animated.spring(offset, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          mass: 1,
          overshootClamping: true,
          useNativeDriver: true,
        });
    a.start();
    return () => a.stop();
  }, [offset, reduced]);
  function dismiss(velocity = 0) {
    if (closing.current) return;
    closing.current = true;
    // A fast flick closes faster, so the sheet keeps the finger's momentum.
    const duration = latest.current.reduced
      ? 0
      : Math.max(120, Math.min(240, 240 - velocity * 60));
    Animated.timing(offset, {
      toValue: latest.current.height,
      duration,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) latest.current.onClose();
    });
  }
  // PanResponder stores these callbacks; refs are read only when gestures fire.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      // Dragging up past the top is resisted instead of hard-stopped.
      onPanResponderMove: (_, g) =>
        offset.setValue(g.dy >= 0 ? g.dy : -Math.sqrt(-g.dy) * 2),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 85 || g.vy > 0.8) dismiss(g.vy);
        else if (latest.current.reduced) offset.setValue(0);
        else
          Animated.spring(offset, {
            toValue: 0,
            velocity: -g.vy,
            damping: 22,
            stiffness: 300,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
      },
      onPanResponderTerminate: () =>
        Animated.timing(offset, {
          toValue: 0,
          duration: latest.current.reduced ? 0 : 200,
          useNativeDriver: true,
        }).start(),
    }),
  );
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={() => dismiss()}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#100B38",
            opacity: offset.interpolate({
              inputRange: [0, height],
              outputRange: [0.42, 0],
              extrapolate: "clamp",
            }),
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paneli kapat"
          onPress={() => dismiss()}
          style={{ position: "absolute", inset: 0 }}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            paddingTop: insets.top + 16,
          }}
        >
          <Animated.View
            accessibilityViewIsModal
            style={{
              maxHeight: height - insets.top - 20,
              backgroundColor: "white",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: insets.bottom,
              transform: [{ translateY: offset }],
            }}
          >
            <View {...pan.panHandlers}>
              <View
                style={{
                  width: 44,
                  height: 5,
                  backgroundColor: "#CFC6EB",
                  borderRadius: 4,
                  alignSelf: "center",
                  marginTop: 10,
                }}
              />
              <View style={s.sheetHeader}>
                <Text style={s.h2} accessibilityRole="header">
                  {title}
                </Text>
                <Pressable
                  accessibilityLabel="Paneli kapat"
                  accessibilityRole="button"
                  onPress={() => dismiss()}
                  style={s.close}
                >
                  <Text style={{ fontSize: 25, color: "#5D47D9" }}>×</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={s.sheetBody}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
