#include <cassert>
#include <cctype>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
string decodeString(const string& s) {
    // one entry each per open "[": the text before it,
    // and how many times its inside repeats
    vector<string> strs;
    vector<int> counts;
    string cur;
    int num = 0;
    for (char ch : s) {
        if (isdigit(ch)) {
            num = num * 10 + (ch - '0');
        } else if (ch == '[') {
            // save where we are, start a fresh string
            strs.push_back(cur);
            counts.push_back(num);
            cur = "";
            num = 0;
        } else if (ch == ']') {
            // saved text, then the inside repeated
            string out = strs.back();
            strs.pop_back();
            for (int i = 0; i < counts.back(); ++i) out += cur;
            counts.pop_back();
            cur = out;
        } else {
            cur += ch;
        }
    }
    return cur;
}
// ---- checks ----
int main() {
    assert(decodeString("3[a]2[bc]") == "aaabcbc");
    assert(decodeString("3[a2[c]]") == "accaccacc");
    assert(decodeString("2[abc]3[cd]ef") == "abcabccdcdcdef");
    assert(decodeString("") == "");
    assert(decodeString("abc") == "abc");
    assert(decodeString("10[a]") == "aaaaaaaaaa");
    assert(decodeString("x2[y3[z]]w") == "xyzzzyzzzw");
    return 0;
}
