# ---- code ----
def interval_intersection(
    a: list[list[int]], b: list[list[int]]
) -> list[list[int]]:
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        # the shared part, if there is one
        lo = max(a[i][0], b[j][0])
        hi = min(a[i][1], b[j][1])
        if lo <= hi:
            out.append([lo, hi])
        # the one that ends first can't meet anything else
        if a[i][1] < b[j][1]:
            i += 1
        else:
            j += 1
    return out
# ---- checks ----
assert interval_intersection(
    [[0, 2], [5, 10], [13, 23], [24, 25]],
    [[1, 5], [8, 12], [15, 24], [25, 26]],
) == [[1, 2], [5, 5], [8, 10], [15, 23], [24, 24], [25, 25]]
assert interval_intersection([[1, 3], [5, 9]], []) == []
assert interval_intersection([], [[4, 8]]) == []
# one interval of b covers several of a
assert interval_intersection([[1, 2], [4, 5], [7, 8]], [[0, 9]]) == [
    [1, 2], [4, 5], [7, 8]]
assert interval_intersection([[1, 2]], [[3, 4]]) == []
assert interval_intersection([[3, 7]], [[3, 7]]) == [[3, 7]]
