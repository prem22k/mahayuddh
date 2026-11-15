#include <cassert>
#include <cstdint>
using namespace std;
// ---- code ----
int hammingWeight(uint32_t n) {
    int count = 0;
    while (n != 0) {
        // n - 1 flips the lowest 1 and the 0s below it,
        // so n & (n - 1) clears exactly that lowest 1
        n &= n - 1;
        count++;
    }
    return count;
}
// ---- checks ----
int main() {
    assert(hammingWeight(11) == 3);
    assert(hammingWeight(128) == 1);
    assert(hammingWeight(2147483645u) == 30);
    assert(hammingWeight(0) == 0);
    // -1 is 32 ones in two's complement
    assert(hammingWeight((uint32_t)-1) == 32);
    // the sign bit alone
    assert(hammingWeight(0x80000000u) == 1);
    // a power of two has one bit, so n & (n - 1) == 0
    assert(hammingWeight(1u << 20) == 1);
    return 0;
}
