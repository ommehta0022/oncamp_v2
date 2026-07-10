import React from 'react';
import { View } from 'react-native';
import { LoadingSkeleton, FeedSkeleton, GroupSkeleton } from './LoadingSkeleton';

type SkeletonType = 'post' | 'card' | 'groupRow';

interface SkeletonLoaderProps {
  type?: SkeletonType;
  count?: number;
}

export default function SkeletonLoader({ type = 'post', count = 1 }: SkeletonLoaderProps) {
  const skeletons = Array.from({ length: count });
  
  if (type === 'post') {
    return (
      <View>
        {skeletons.map((_, i) => (
          <FeedSkeleton key={i} />
        ))}
      </View>
    );
  }
  
  if (type === 'groupRow') {
    return (
      <View>
        {skeletons.map((_, i) => (
          <GroupSkeleton key={i} />
        ))}
      </View>
    );
  }
  
  // Default 'card'
  return (
    <View>
      {skeletons.map((_, i) => (
        <View key={i} style={{ padding: 16 }}>
           <LoadingSkeleton width="100%" height={150} borderRadius={12} style={{ marginBottom: 16 }} />
        </View>
      ))}
    </View>
  );
}
