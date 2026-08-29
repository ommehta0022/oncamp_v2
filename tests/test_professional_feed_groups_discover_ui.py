from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_feed_header_uses_brand_identity_and_real_global_search():
    source = read("frontend/app/(tabs)/feed.tsx")
    assert 'const APP_ICON = require("../../assets/images/icon.png")' in source
    assert '<Image source={APP_ICON}' in source
    assert 'router.push("/search")' in source
    assert 'testID="feed-search-btn"' in source
    assert 'router.push("/(tabs)/discover"' not in source


def test_personal_post_pin_integrates_menu_and_feed_ordering():
    feed = read("frontend/app/(tabs)/feed.tsx")
    card = read("frontend/src/components/PostCard.tsx")
    assert 'usePinnedContent' in feed
    assert 'personalPinned: isPostPinned(post.id)' in feed
    assert 'Number(right.personalPinned) - Number(left.personalPinned)' in feed
    assert 'usePinnedContent' in card
    assert 'Pin to my feed' in card
    assert 'Unpin from my feed' in card
    assert 'togglePostPin(item.id)' in card


def test_like_is_single_tap_thumb_with_long_press_reaction_picker():
    card = read("frontend/src/components/PostCard.tsx")
    picker = read("frontend/src/components/ReactionMenu.tsx")
    assert '"thumbs-up-outline"' in card
    assert 'handlePrimaryReaction' in card
    assert 'onLongPress={() => setReactionMenuVisible(true)}' in card
    assert 'delayLongPress={320}' in card
    assert 'Long press to choose another reaction' in card
    assert 'maxWidth: 430' in picker
    assert 'flexDirection: "row"' in picker
    assert 'flexWrap: "wrap"' not in picker


def test_groups_use_shared_theme_without_corner_badges_or_avatar_dot():
    tabs = read("frontend/app/(tabs)/_layout.tsx")
    groups = read("frontend/app/(tabs)/groups.tsx")
    groups_tab = tabs.split('<Tabs.Screen name="groups"', 1)[1].split('<Tabs.Screen name="discover"', 1)[0]
    assert 'tabBarBadge' not in groups_tab
    assert 'verified={group.verified}' not in groups
    assert 'categoryColors' not in groups
    assert 'backgroundColor: colors.brandTertiary' in groups
    assert 'testID="groups-search-input"' in groups


def test_discover_has_no_fake_filter_or_dead_see_all_action():
    source = read("frontend/app/(tabs)/discover.tsx")
    assert 'testID="discover-search-input"' in source
    assert 'options-outline' not in source
    assert 'See All' not in source
    assert '<SectionHeader title="Featured Institutions" />' in source
    assert '<SectionHeader title="Trending Campuses" />' in source
