import java.util.*;
// ---- code ----
class Solution {
    public int lengthOfLongestSubstring(String s) {
        // what's inside the window
        Map<Character, Integer> count = new HashMap<>();
        int left = 0, best = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            // 1. grow: take s[right] in
            count.merge(c, 1, Integer::sum);
            // 2. shrink while the window is invalid
            while (count.get(c) > 1) {
                count.merge(s.charAt(left), -1, Integer::sum);
                left++;
            }
            // 3. valid again: record it
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.lengthOfLongestSubstring("pwwkew") == 3, "pwwkew");
        check(s.lengthOfLongestSubstring("abcabcbb") == 3, "abcabcbb");
        check(s.lengthOfLongestSubstring("bbbbb") == 1, "bbbbb");
        check(s.lengthOfLongestSubstring("") == 0, "empty");
        check(s.lengthOfLongestSubstring("dvdf") == 3, "dvdf");
        check(s.lengthOfLongestSubstring("abba") == 2, "abba");
    }
}
