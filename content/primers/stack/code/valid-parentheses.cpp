#include <cassert>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
bool isValid(const string& s) {
    // each closer and the opener it needs
    unordered_map<char, char> pairs = {
        {')', '('}, {']', '['}, {'}', '{'}};
    vector<char> stack;
    for (char ch : s) {
        if (!pairs.count(ch)) {
            // an opener: wait for its closer
            stack.push_back(ch);
        } else if (stack.empty() || stack.back() != pairs[ch]) {
            // nothing open, or the wrong kind is open
            return false;
        } else {
            // closes the most recent open bracket
            stack.pop_back();
        }
    }
    // anything still open was never closed
    return stack.empty();
}
// ---- checks ----
int main() {
    assert(isValid("([]{})"));
    assert(isValid("()"));
    assert(isValid("{[]}"));
    assert(isValid(""));
    assert(!isValid("(]"));
    assert(!isValid("([)]"));
    assert(!isValid("("));
    assert(!isValid("]"));
    assert(!isValid(")("));
    return 0;
}
