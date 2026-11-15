#include <cassert>
#include <string>
#include <vector>
using namespace std;
// ---- code ----
int evalRPN(const vector<string>& tokens) {
    vector<int> stack;
    for (const string& tok : tokens) {
        bool isOp = tok == "+" || tok == "-"
                    || tok == "*" || tok == "/";
        if (!isOp) {
            stack.push_back(stoi(tok));
            continue;
        }
        // the top is the RIGHT operand: pop it first
        int b = stack.back();
        stack.pop_back();
        int a = stack.back();
        stack.pop_back();
        if (tok == "+") {
            stack.push_back(a + b);
        } else if (tok == "-") {
            stack.push_back(a - b);
        } else if (tok == "*") {
            stack.push_back(a * b);
        } else {
            // divide, rounding toward zero
            stack.push_back(a / b);
        }
    }
    return stack.back();
}
// ---- checks ----
int main() {
    assert(evalRPN({"2", "1", "+", "3", "*"}) == 9);
    assert(evalRPN({"4", "13", "5", "/", "+"}) == 6);
    assert(evalRPN({"10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"}) == 22);
    assert(evalRPN({"7"}) == 7);
    assert(evalRPN({"3", "4", "-"}) == -1);
    assert(evalRPN({"8", "2", "/"}) == 4);
    assert(evalRPN({"-7", "2", "/"}) == -3);
    return 0;
}
