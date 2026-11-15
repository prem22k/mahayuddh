#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<int> dailyTemperatures(const vector<int>& temps) {
    vector<int> ans(temps.size(), 0);
    // days still waiting for a warmer one; their temps
    // never rise from the bottom of the stack to the top
    vector<int> stack;
    for (int i = 0; i < (int)temps.size(); ++i) {
        // today answers every colder day on top
        while (!stack.empty()
               && temps[stack.back()] < temps[i]) {
            int j = stack.back();
            stack.pop_back();
            ans[j] = i - j;
        }
        stack.push_back(i);
    }
    // days left on the stack never warm up: they stay 0
    return ans;
}
// ---- checks ----
int main() {
    assert((dailyTemperatures({73, 74, 75, 71, 69, 72, 76, 73}) == vector<int>{1, 1, 4, 2, 1, 1, 0, 0}));
    assert((dailyTemperatures({30, 40, 50, 60}) == vector<int>{1, 1, 1, 0}));
    assert((dailyTemperatures({30, 60, 90}) == vector<int>{1, 1, 0}));
    assert(dailyTemperatures({}).empty());
    assert((dailyTemperatures({50}) == vector<int>{0}));
    assert((dailyTemperatures({70, 70, 71}) == vector<int>{2, 1, 0}));
    assert((dailyTemperatures({90, 80, 70}) == vector<int>{0, 0, 0}));
    return 0;
}
