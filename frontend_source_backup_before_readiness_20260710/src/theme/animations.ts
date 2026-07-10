import { Animated, Easing } from 'react-native';

export const springConfig = { tension: 100, friction: 8 };

export const fadeIn = (value: Animated.Value, duration = 300) => 
  Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true });

export const slideUp = (value: Animated.Value, fromY = 50) =>
  Animated.spring(value, { toValue: 0, ...springConfig, useNativeDriver: true });

export const scalePress = (value: Animated.Value) =>
  Animated.spring(value, { toValue: 0.96, ...springConfig, useNativeDriver: true });
