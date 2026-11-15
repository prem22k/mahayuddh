#include <algorithm>
#include <cassert>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;
// ---- code ----
vector<vector<string>> groupAnagrams(vector<string> strs) {
    // sorted letters -> every word with those letters
    unordered_map<string, vector<string>> groups;
    for (const string& w : strs) {
        string key = w;
        sort(key.begin(), key.end());
        groups[key].push_back(w);
    }
    vector<vector<string>> out;
    for (auto& entry : groups) out.push_back(entry.second);
    return out;
}
// ---- checks ----
vector<vector<string>> norm(vector<vector<string>> gs) {
    for (auto& g : gs) sort(g.begin(), g.end());
    sort(gs.begin(), gs.end());
    return gs;
}
int main() {
    using G = vector<vector<string>>;
    assert((norm(groupAnagrams({"eat", "tea", "tan", "ate", "nat", "bat"})) ==
            G{{"ate", "eat", "tea"}, {"bat"}, {"nat", "tan"}}));
    assert((norm(groupAnagrams({""})) == G{{""}}));
    assert((norm(groupAnagrams({"a"})) == G{{"a"}}));
    assert(groupAnagrams({}).empty());
    assert((norm(groupAnagrams({"ab", "aab", "ba"})) == G{{"aab"}, {"ab", "ba"}}));
    return 0;
}
