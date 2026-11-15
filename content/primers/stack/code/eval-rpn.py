def eval_rpn(tokens: list[str]) -> int:
    stack: list[int] = []
    for tok in tokens:
        if tok not in ("+", "-", "*", "/"):
            stack.append(int(tok))
            continue
        # the top is the RIGHT operand: pop it first
        b = stack.pop()
        a = stack.pop()
        if tok == "+":
            stack.append(a + b)
        elif tok == "-":
            stack.append(a - b)
        elif tok == "*":
            stack.append(a * b)
        else:
            # divide, rounding toward zero
            stack.append(int(a / b))
    return stack[-1]
# ---- checks ----
assert eval_rpn(["2", "1", "+", "3", "*"]) == 9
assert eval_rpn(["4", "13", "5", "/", "+"]) == 6
assert eval_rpn(["10", "6", "9", "3", "+", "-11", "*", "/", "*",
                 "17", "+", "5", "+"]) == 22
assert eval_rpn(["7"]) == 7
# operand order matters for - and /
assert eval_rpn(["3", "4", "-"]) == -1
assert eval_rpn(["8", "2", "/"]) == 4
# toward zero, not floor: -7 / 2 is -3
assert eval_rpn(["-7", "2", "/"]) == -3
