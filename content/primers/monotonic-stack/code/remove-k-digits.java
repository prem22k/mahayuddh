import java.util.*;
// ---- code ----
class Solution {
    public String removeKdigits(String num, int k) {
        // digits kept so far; they never fall bottom to top
        StringBuilder stack = new StringBuilder();
        for (char d : num.toCharArray()) {
            // a bigger digit just before a smaller one: drop it
            while (k > 0 && stack.length() > 0
                   && stack.charAt(stack.length() - 1) > d) {
                stack.deleteCharAt(stack.length() - 1);
                k--;
            }
            stack.append(d);
        }
        // any removals still owed come off the (largest) end
        stack.setLength(stack.length() - k);
        // strip leading zeros; nothing left means "0"
        int start = 0;
        while (start < stack.length()
               && stack.charAt(start) == '0') start++;
        String out = stack.substring(start);
        return out.isEmpty() ? "0" : out;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.removeKdigits("1432219", 3).equals("1219"), "example 1");
        check(s.removeKdigits("10200", 1).equals("200"), "leading zeros");
        check(s.removeKdigits("10", 2).equals("0"), "remove all");
        check(s.removeKdigits("9", 1).equals("0"), "single");
        check(s.removeKdigits("12345", 0).equals("12345"), "k = 0");
        check(s.removeKdigits("12345", 2).equals("123"), "rising");
        check(s.removeKdigits("112", 1).equals("11"), "equal digits");
        check(s.removeKdigits("100", 1).equals("0"), "all zeros left");
    }
}
