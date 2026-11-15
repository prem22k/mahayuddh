// ---- code ----
class Solution {
    // n is read as 32 bits, sign bit included
    public int hammingWeight(int n) {
        int count = 0;
        while (n != 0) {
            // n - 1 flips the lowest 1 and the 0s below it,
            // so n & (n - 1) clears exactly that lowest 1
            n &= n - 1;
            count++;
        }
        return count;
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }

    public static void main(String[] args) {
        Solution s = new Solution();
        check(s.hammingWeight(11) == 3, "example 1");
        check(s.hammingWeight(128) == 1, "example 2");
        check(s.hammingWeight(2147483645) == 30, "example 3");
        check(s.hammingWeight(0) == 0, "zero");
        // -1 is 32 ones in two's complement
        check(s.hammingWeight(-1) == 32, "all ones");
        // the sign bit alone
        check(s.hammingWeight(Integer.MIN_VALUE) == 1, "sign bit");
        // a power of two has one bit, so n & (n - 1) == 0
        check(s.hammingWeight(1 << 20) == 1, "power of two");
    }
}
