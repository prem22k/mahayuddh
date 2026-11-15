import java.util.*;
// ---- code ----
class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();
        for (String tok : tokens) {
            if (!List.of("+", "-", "*", "/").contains(tok)) {
                stack.push(Integer.parseInt(tok));
                continue;
            }
            // the top is the RIGHT operand: pop it first
            int b = stack.pop();
            int a = stack.pop();
            if (tok.equals("+")) {
                stack.push(a + b);
            } else if (tok.equals("-")) {
                stack.push(a - b);
            } else if (tok.equals("*")) {
                stack.push(a * b);
            } else {
                // divide, rounding toward zero
                stack.push(a / b);
            }
        }
        return stack.peek();
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.evalRPN(new String[]{"2", "1", "+", "3", "*"}) == 9, "example 1");
        check(s.evalRPN(new String[]{"4", "13", "5", "/", "+"}) == 6, "example 2");
        check(s.evalRPN(new String[]{"10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"}) == 22, "example 3");
        check(s.evalRPN(new String[]{"7"}) == 7, "single number");
        check(s.evalRPN(new String[]{"3", "4", "-"}) == -1, "subtract order");
        check(s.evalRPN(new String[]{"8", "2", "/"}) == 4, "divide order");
        check(s.evalRPN(new String[]{"-7", "2", "/"}) == -3, "toward zero");
    }
}
