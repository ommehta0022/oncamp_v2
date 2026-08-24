import React from "react";

type Props = {
  children: React.ReactNode;
  name: string;
};

type State = {
  failed: boolean;
};

/**
 * Optional background features (updates, coordinators, passive modals) must never
 * be able to take down the primary navigation tree during startup.
 */
export default class OptionalFeatureBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[OnCampus:${this.props.name}] optional feature disabled after render error`, error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
