def asteroid_collision(asteroids: list[int]) -> list[int]:
    # survivors so far, left to right
    stack: list[int] = []
    for a in asteroids:
        alive = True
        # a moves left into one moving right: they collide
        while alive and a < 0 and stack and stack[-1] > 0:
            if stack[-1] < -a:
                # smaller top explodes; a keeps going
                stack.pop()
                continue
            if stack[-1] == -a:
                # same size: both explode
                stack.pop()
            alive = False
        if alive:
            stack.append(a)
    return stack
# ---- checks ----
assert asteroid_collision([5, 10, -5]) == [5, 10]
assert asteroid_collision([8, -8]) == []
assert asteroid_collision([10, 2, -5]) == [10]
assert asteroid_collision([]) == []
assert asteroid_collision([5]) == [5]
# moving apart never collide
assert asteroid_collision([-2, -1, 1, 2]) == [-2, -1, 1, 2]
# one left-mover can destroy several in a row
assert asteroid_collision([1, 2, 3, -10, 4]) == [-10, 4]
assert asteroid_collision([1, -2, -2, -2]) == [-2, -2, -2]
