import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutAnimation, ScrollView, View } from "react-native";
import { Tab } from "../domain/selectors";
import { selectionFeedback } from "../platform/haptics";
const tabs: Tab[] = ["Bugün", "Yaklaşan", "Sonra"];
export function TaskPager({
  selected,
  onSelect,
  reduced,
  renderPage,
  scrollX,
  onWidth,
}: {
  selected: Tab;
  onSelect: (t: Tab) => void;
  reduced: boolean;
  renderPage: (t: Tab) => React.ReactNode;
  scrollX?: Animated.Value;
  onWidth?: (w: number) => void;
}) {
  const [width, setWidth] = useState(0),
    [heights, setHeights] = useState<Record<string, number>>({}),
    [shown, setShown] = useState(160);
  const userGesture = useRef(false),
    // Page a swipe is already landing on; no programmatic scroll needed.
    swipeTo = useRef<number | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    const landing = swipeTo.current;
    swipeTo.current = null;
    if (landing === tabs.indexOf(selected)) return;
    if (width)
      scroll.current?.scrollTo({
        x: tabs.indexOf(selected) * width,
        animated: !reduced,
      });
  }, [selected, width, reduced]);
  const target = heights[selected] || 160;
  // Resize with a native layout animation instead of a JS-driven height tween,
  // so the list never stutters while the pager changes height. (Adjusting
  // state during render is React's pattern for values derived from props.)
  if (target !== shown) {
    if (!reduced)
      LayoutAnimation.configureNext(
        LayoutAnimation.create(220, "easeInEaseOut", "opacity"),
      );
    setShown(target);
  }
  // The offset is tracked on the native thread for the tab indicator.
  const [onScroll] = useState(() =>
    scrollX
      ? Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })
      : undefined,
  );
  function settle(x: number) {
    if (!width) return;
    const page = Math.max(0, Math.min(2, Math.round(x / width)));
    const t = tabs[page];
    if (t !== selected) {
      swipeTo.current = page;
      selectionFeedback();
      onSelect(t);
    }
  }
  return (
    <View
      style={{ height: shown, overflow: "hidden" }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setWidth(w);
        onWidth?.(w);
      }}
    >
      <Animated.ScrollView
        ref={scroll}
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          userGesture.current = true;
        }}
        onScrollEndDrag={(e) => {
          // iOS reports where paging will land; switch the tab right away.
          const target = (
            e.nativeEvent as { targetContentOffset?: { x: number } }
          ).targetContentOffset;
          if (userGesture.current && target) {
            userGesture.current = false;
            settle(target.x);
          }
        }}
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={(e) => {
          if (!width || !userGesture.current) return;
          userGesture.current = false;
          settle(e.nativeEvent.contentOffset.x);
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
      </Animated.ScrollView>
    </View>
  );
}
