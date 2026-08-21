import React, { useEffect } from "react";

/**
 * Retained only for source compatibility with older screens.
 * Students cannot create/share/repost posts or submit post-publishing requests.
 * Institution collaboration is handled exclusively by Institution Content Studio.
 */
export function SharePostModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
  institutionId: string;
}) {
  useEffect(() => {
    if (visible) onClose();
  }, [visible, onClose]);

  return null;
}
