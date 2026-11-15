#include <cassert>
#include <vector>
using namespace std;
// ---- code ----
vector<int> asteroidCollision(const vector<int>& asteroids) {
    // survivors so far, left to right
    vector<int> stack;
    for (int a : asteroids) {
        bool alive = true;
        // a moves left into one moving right: they collide
        while (alive && a < 0 && !stack.empty()
               && stack.back() > 0) {
            if (stack.back() < -a) {
                // smaller top explodes; a keeps going
                stack.pop_back();
                continue;
            }
            if (stack.back() == -a) {
                // same size: both explode
                stack.pop_back();
            }
            alive = false;
        }
        if (alive) stack.push_back(a);
    }
    return stack;
}
// ---- checks ----
int main() {
    assert((asteroidCollision({5, 10, -5}) == vector<int>{5, 10}));
    assert(asteroidCollision({8, -8}).empty());
    assert((asteroidCollision({10, 2, -5}) == vector<int>{10}));
    assert(asteroidCollision({}).empty());
    assert((asteroidCollision({5}) == vector<int>{5}));
    assert((asteroidCollision({-2, -1, 1, 2}) == vector<int>{-2, -1, 1, 2}));
    assert((asteroidCollision({1, 2, 3, -10, 4}) == vector<int>{-10, 4}));
    assert((asteroidCollision({1, -2, -2, -2}) == vector<int>{-2, -2, -2}));
    return 0;
}
