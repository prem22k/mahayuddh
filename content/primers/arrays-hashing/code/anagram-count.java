import java.util.*;
// ---- code ----
class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        // letter -> (times in s) - (times in t)
        Map<Character, Integer> count = new HashMap<>();
        for (int i = 0; i < s.length(); i++) {
            count.merge(s.charAt(i), 1, Integer::sum);
            count.merge(t.charAt(i), -1, Integer::sum);
        }
        // an anagram leaves every count at zero
        for (int c : count.values()) {
            if (c != 0) return false;
        }
        return true;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.isAnagram("anagram", "nagaram"), "example");
        check(!s.isAnagram("rat", "car"), "not anagram");
        check(s.isAnagram("", ""), "empty");
        check(s.isAnagram("a", "a"), "single");
        check(!s.isAnagram("a", "ab"), "lengths differ");
        check(!s.isAnagram("aacc", "ccac"), "same letters, different counts");
    }
}
