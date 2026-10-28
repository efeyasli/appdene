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
    const a = Animated.timing(offset, {
      toValue: 0,
      duration: reduced ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [offset, reduced]);
  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(offset, {
      toValue: latest.current.height,
      duration: latest.current.reduced ? 0 : 220,
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
      onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 85 || g.vy > 0.8) dismiss();
        else
          Animated.timing(offset, {
            toValue: 0,
            duration: latest.current.reduced ? 0 : 200,
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
      onRequestClose={dismiss}
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
          onPress={dismiss}
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
                  onPress={dismiss}
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
