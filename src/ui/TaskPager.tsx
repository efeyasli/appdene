import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, View } from "react-native";
import { Tab } from "../domain/selectors";
import { selectionFeedback } from "../platform/haptics";
const tabs: Tab[] = ["Bugün", "Yaklaşan", "Sonra"];
export function TaskPager({
  selected,
  onSelect,
  reduced,
  renderPage,
}: {
  selected: Tab;
  onSelect: (t: Tab) => void;
  reduced: boolean;
  renderPage: (t: Tab) => React.ReactNode;
}) {
  const [width, setWidth] = useState(0),
    [heights, setHeights] = useState<Record<string, number>>({});
  const userGesture = useRef(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    [height] = useState(() => new Animated.Value(160));
  useEffect(() => {
    userGesture.current = false;
    if (width)
      scroll.current?.scrollTo({
        x: tabs.indexOf(selected) * width,
        animated: !reduced,
      });
  }, [selected, width, reduced]);
  useEffect(() => {
    const a = Animated.timing(height, {
      toValue: heights[selected] || 160,
      duration: reduced ? 0 : 220,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [height, heights, selected, reduced]);
  return (
    <Animated.View
      style={{ height, overflow: "hidden" }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroll}
        horizontal
        onScrollBeginDrag={() => {
          userGesture.current = true;
        }}
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => {
          if (!width || !userGesture.current) return;
          userGesture.current = false;
          const t =
            tabs[
              Math.max(
                0,
                Math.min(2, Math.round(e.nativeEvent.contentOffset.x / width)),
              )
            ];
          if (t !== selected) {
            selectionFeedback();
            onSelect(t);
          }
        }}
      >
        {width > 0 &&
          tabs.map((t) => (
            <View
              key={t}
              style={{ width, alignSelf: "flex-start" }}
              accessibilityElementsHidden={selected !== t}
              importantForAccessibility={
                selected === t ? "auto" : "no-hide-descendants"
              }
            >
              <View
                onLayout={(e) => {
                  const n = Math.ceil(e.nativeEvent.layout.height);
                  setHeights((old) =>
                    old[t] === n ? old : { ...old, [t]: n },
                  );
                }}
              >
                {renderPage(t)}
              </View>
            </View>
          ))}
      </ScrollView>
    </Animated.View>
  );
}
