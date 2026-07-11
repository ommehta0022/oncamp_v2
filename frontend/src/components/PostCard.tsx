import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PostCard({ post }: { post: any }) {
  return (
    <View style={styles.card}>
      <Text>{post?.content || 'Post Content'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: '#fff', marginBottom: 10, borderRadius: 8 },
});
