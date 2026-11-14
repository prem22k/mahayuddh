#include <algorithm>
#include <cassert>
#include <string>
#include <unordered_map>
using namespace std;
// ---- code ----
int lengthOfLongestSubstring(const string& s) {
    unordered_map<char, int> count;  // what's inside the window
    int left = 0, best = 0;
    for (int right = 0; right < (int)s.size(); ++right) {
        char c = s[right];
        // 1. grow: take s[right] in
        ++count[c];
        // 2. shrink while the window is invalid
        while (count[c] > 1) {
            --count[s[left]];
            ++left;
        }
        // 3. valid again: record it
        best = max(best, right - left + 1);
    }
    return best;
}
// ---- checks ----
int main() {
    assert(lengthOfLongestSubstring("pwwkew") == 3);
    assert(lengthOfLongestSubstring("abcabcbb") == 3);
    assert(lengthOfLongestSubstring("bbbbb") == 1);
    assert(lengthOfLongestSubstring("") == 0);
    assert(lengthOfLongestSubstring("dvdf") == 3);
    assert(lengthOfLongestSubstring("abba") == 2);
    return 0;
}
