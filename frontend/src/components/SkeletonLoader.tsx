import React from 'react';
import { View } from 'react-native';
import { LoadingSkeleton, FeedSkeleton, GroupSkeleton } from './LoadingSkeleton';
import CampusLoader from './CampusLoader';

type SkeletonType = 'post' | 'card' | 'groupRow';

interface SkeletonLoaderProps {
  type?: SkeletonType;
  count?: number;
  label?: string;
}

export default function SkeletonLoader({ type = 'post', count = 1, label = 'Loading campus data…' }: SkeletonLoaderProps) {
  const skeletons = Array.from({ length: count });

  return (
    <View>
      <CampusLoader compact label={label} style={{ paddingVertical: 18 }} />
      {type === 'post' ? skeletons.map((_, i) => <FeedSkeleton key={i} />) : null}
      {type === 'groupRow' ? skeletons.map((_, i) => <GroupSkeleton key={i} />) : null}
      {type === 'card' ? skeletons.map((_, i) => (
        <View key={i} style={{ padding: 16 }}>
          <LoadingSkeleton width="100%" height={150} borderRadius={12} style={{ marginBottom: 16 }} />
        </View>
      )) : null}
    </View>
  );
}
