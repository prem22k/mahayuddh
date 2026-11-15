#include <cassert>
#include <string>
using namespace std;
// ---- code ----
string removeKdigits(const string& num, int k) {
    // digits kept so far; they never fall bottom to top
    string stack;
    for (char d : num) {
        // a bigger digit just before a smaller one: drop it
        while (k > 0 && !stack.empty() && stack.back() > d) {
            stack.pop_back();
            --k;
        }
        stack.push_back(d);
    }
    // any removals still owed come off the (largest) end
    stack.resize(stack.size() - k);
    // strip leading zeros; nothing left means "0"
    size_t start = stack.find_first_not_of('0');
    return start == string::npos ? "0" : stack.substr(start);
}
// ---- checks ----
int main() {
    assert(removeKdigits("1432219", 3) == "1219");
    assert(removeKdigits("10200", 1) == "200");
    assert(removeKdigits("10", 2) == "0");
    assert(removeKdigits("9", 1) == "0");
    assert(removeKdigits("12345", 0) == "12345");
    assert(removeKdigits("12345", 2) == "123");
    assert(removeKdigits("112", 1) == "11");
    assert(removeKdigits("100", 1) == "0");
    return 0;
}
