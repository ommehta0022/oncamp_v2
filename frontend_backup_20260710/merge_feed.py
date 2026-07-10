import os
import re

v1_path = r'd:\oncampus_V2\oncampuses-v1\frontend\app\(tabs)\feed.tsx'
v2_path = r'd:\oncampus_V2\oncamp_v2\frontend\app\(tabs)\feed.tsx'

with open(v1_path, 'r', encoding='utf-8') as f:
    v1_content = f.read()

with open(v2_path, 'r', encoding='utf-8') as f:
    v2_content = f.read()

# Extract v1 Feed return block
v1_return_match = re.search(r'  return \(\s*<SafeAreaView.*?\);\n}', v1_content, re.DOTALL)
if not v1_return_match:
    print("Could not find v1 Feed return")
    exit(1)
v1_return = v1_return_match.group(0)

# Extract v1 Composer, PostCard, ActionBtn, styles
v1_helpers_match = re.search(r'function Composer\(\) \{.*', v1_content, re.DOTALL)
if not v1_helpers_match:
    print("Could not find v1 helpers")
    exit(1)
v1_helpers = v1_helpers_match.group(0)

# In v1_return, replace toggleLike(item.id) with handleReact(item.id, "like") or similar?
# v2 has toggleLike, handleReact, toggleBookmark, openImage, setActiveOptionsPost, setActiveReactionPost
# We need to wire these up in the new PostCard!
# But for now, let's just keep v2's toggleLike
v1_return = v1_return.replace('toggleLike(item.id)', 'toggleLike(item.id)')
v1_return = v1_return.replace('canCreatePosts ? <Composer /> : <View style={{ height: spacing.md }} />', 'canCreatePosts ? <Composer /> : <View style={{ height: spacing.md }} />')

# Find v2 Feed return block
v2_return_match = re.search(r'  return \(\s*<SafeAreaView.*?\n\s*\);\n}', v2_content, re.DOTALL)
if not v2_return_match:
    print("Could not find v2 Feed return")
    exit(1)
v2_return = v2_return_match.group(0)

# Replace v2 Feed return with v1 Feed return
# BUT wait! v2 has a bunch of modals at the end of its return block: ImageViewer, OptionsMenu, ReportModal, ReactionMenu.
# We must preserve them!
# So we inject them into v1's return block before the closing </SafeAreaView>

v2_modals_match = re.search(r'(\s*<ImageViewer.*?</SafeAreaView>)', v2_return, re.DOTALL)
v2_modals = ""
if v2_modals_match:
    v2_modals = v2_modals_match.group(1).replace('</SafeAreaView>', '')

v1_return_with_modals = v1_return.replace('</SafeAreaView>', v2_modals + '\n    </SafeAreaView>')

# Now replace v2 return block
new_v2 = v2_content.replace(v2_return, v1_return_with_modals)

# Remove v2's old helper functions and styles at the bottom (anything after Feed function)
# Actually, it's easier to just strip them using regex
new_v2 = re.sub(r'const styles = StyleSheet\.create\(\{.*', '', new_v2, flags=re.DOTALL)

# Append v1's helpers and styles
new_v2 = new_v2 + "\n\n" + v1_helpers

with open(r'd:\oncampus_V2\oncamp_v2\frontend\app\(tabs)\feed.tsx', 'w', encoding='utf-8') as f:
    f.write(new_v2)

print("Successfully merged v1 UI into v2 feed.tsx!")
