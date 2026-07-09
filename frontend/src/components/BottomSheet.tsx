import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, Animated, PanResponder, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/colors";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: string[]; // e.g., ["50%", "90%"]
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export default function BottomSheet({ visible, onClose, children, snapPoints = ["50%"], header, footer }: BottomSheetProps) {
  const { colors } = useTheme();
  const [renderVisible, setRenderVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Convert string snap points to numbers
  const maxSnapHeight = Math.max(...snapPoints.map(p => {
    if (p.endsWith("%")) return (parseFloat(p) / 100) * SCREEN_HEIGHT;
    return parseFloat(p);
  }));

  useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start(() => {
        setRenderVisible(false);
      });
    }
  }, [visible, slideAnim, opacityAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > maxSnapHeight * 0.3 || gestureState.vy > 1.5) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!renderVisible) return null;

  return (
    <Modal visible={renderVisible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View 
            style={[
              styles.backdrop, 
              { 
                backgroundColor: colors.overlay || "rgba(0,0,0,0.4)",
                opacity: opacityAnim 
              }
            ]} 
          />
        </TouchableWithoutFeedback>

        <Animated.View 
          style={[
            styles.sheet, 
            { 
              backgroundColor: colors.background || colors.surface, 
              height: maxSnapHeight,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.borderStrong || colors.border }]} />
          </View>
          
          {header && <View style={styles.header}>{header}</View>}
          
          <View style={styles.content}>
            {children}
          </View>
          
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    overflow: "hidden",
  },
  handleContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150,150,150,0.2)",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150,150,150,0.2)",
  }
});
