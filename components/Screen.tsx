import { PropsWithChildren, ReactNode, useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, elevation, spacing } from "@/constants/theme";

type Props = PropsWithChildren<{
  /**
   * Supply this and the screen gains pull-to-refresh. Every screen that loads from the
   * network should: the app has live salon availability and live bookings, and without
   * it the only way to force a reload was to navigate away and back.
   */
  onRefresh?: () => void | Promise<unknown>;
  /**
   * A bar pinned to the bottom, outside the scroll view — the primary action of a flow,
   * or a running total. Previously these were the last element inside the scroll, so the
   * "Continue" button on a long service list was below the fold and the flow looked like
   * it had no way forward.
   */
  footer?: ReactNode;
  /** Turn off the default 16pt gutter for a screen with edge-to-edge content. */
  padded?: boolean;
}>;

export function Screen({ children, onRefresh, footer, padded = true }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[s.content, padded && s.padded, Boolean(footer) && s.withFooter]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[colors.deepGreen]}
              onRefresh={refresh}
              refreshing={refreshing}
              tintColor={colors.deepGreen}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: spacing.xxl },
  padded: { padding: spacing.md },
  withFooter: { paddingBottom: spacing.md },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...elevation.lg,
  },
});
