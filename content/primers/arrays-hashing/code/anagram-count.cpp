#include <cassert>
#include <string>
#include <unordered_map>
using namespace std;
// ---- code ----
bool isAnagram(const string& s, const string& t) {
    if (s.size() != t.size()) return false;
    // letter -> (times in s) - (times in t)
    unordered_map<char, int> count;
    for (size_t i = 0; i < s.size(); ++i) {
        ++count[s[i]];
        --count[t[i]];
    }
    // an anagram leaves every count at zero
    for (const auto& entry : count) {
        if (entry.second != 0) return false;
    }
    return true;
}
// ---- checks ----
int main() {
    assert(isAnagram("anagram", "nagaram"));
    assert(!isAnagram("rat", "car"));
    assert(isAnagram("", ""));
    assert(isAnagram("a", "a"));
    assert(!isAnagram("a", "ab"));
    assert(!isAnagram("aacc", "ccac"));
    return 0;
}
