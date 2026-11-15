import java.util.*;
// ---- code ----
class Solution {
    public boolean isValid(String s) {
        // each closer and the opener it needs
        Map<Character, Character> pairs =
            Map.of(')', '(', ']', '[', '}', '{');
        Deque<Character> stack = new ArrayDeque<>();
        for (char ch : s.toCharArray()) {
            if (!pairs.containsKey(ch)) {
                // an opener: wait for its closer
                stack.push(ch);
            } else if (stack.isEmpty()
                    || !stack.peek().equals(pairs.get(ch))) {
                // nothing open, or the wrong kind is open
                return false;
            } else {
                // closes the most recent open bracket
                stack.pop();
            }
        }
        // anything still open was never closed
        return stack.isEmpty();
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.isValid("([]{})"), "walkthrough");
        check(s.isValid("()"), "pair");
        check(s.isValid("{[]}"), "nested");
        check(s.isValid(""), "empty");
        check(!s.isValid("(]"), "wrong kind");
        check(!s.isValid("([)]"), "crossed");
        check(!s.isValid("("), "left open");
        check(!s.isValid("]"), "nothing open");
        check(!s.isValid(")("), "wrong order");
    }
}
