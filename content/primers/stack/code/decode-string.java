import java.util.*;
// ---- code ----
class Solution {
    public String decodeString(String s) {
        // one entry each per open "[": the text before it,
        // and how many times its inside repeats
        Deque<String> strs = new ArrayDeque<>();
        Deque<Integer> counts = new ArrayDeque<>();
        String cur = "";
        int num = 0;
        for (char ch : s.toCharArray()) {
            if (Character.isDigit(ch)) {
                num = num * 10 + (ch - '0');
            } else if (ch == '[') {
                // save where we are, start a fresh string
                strs.push(cur);
                counts.push(num);
                cur = "";
                num = 0;
            } else if (ch == ']') {
                // saved text, then the inside repeated
                cur = strs.pop() + cur.repeat(counts.pop());
            } else {
                cur += ch;
            }
        }
        return cur;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.decodeString("3[a]2[bc]").equals("aaabcbc"), "example 1");
        check(s.decodeString("3[a2[c]]").equals("accaccacc"), "nested");
        check(s.decodeString("2[abc]3[cd]ef").equals("abcabccdcdcdef"), "tail text");
        check(s.decodeString("").equals(""), "empty");
        check(s.decodeString("abc").equals("abc"), "no brackets");
        check(s.decodeString("10[a]").equals("aaaaaaaaaa"), "two-digit count");
        check(s.decodeString("x2[y3[z]]w").equals("xyzzzyzzzw"), "text around nesting");
    }
}
