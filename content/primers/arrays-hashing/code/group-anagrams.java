import java.util.*;
// ---- code ----
class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // sorted letters -> every word with those letters
        Map<String, List<String>> groups = new HashMap<>();
        for (String w : strs) {
            char[] letters = w.toCharArray();
            Arrays.sort(letters);
            String key = new String(letters);
            groups.computeIfAbsent(key, k -> new ArrayList<>())
                  .add(w);
        }
        return new ArrayList<>(groups.values());
    }
}
// ---- checks ----
class Main {
    static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); }
    static List<List<String>> norm(List<List<String>> gs) {
        List<List<String>> out = new ArrayList<>();
        for (List<String> g : gs) { List<String> c = new ArrayList<>(g); Collections.sort(c); out.add(c); }
        out.sort(Comparator.comparing(Object::toString));
        return out;
    }
    public static void main(String[] args) {
        Solution s = new Solution();
        check(norm(s.groupAnagrams(new String[]{"eat", "tea", "tan", "ate", "nat", "bat"})).equals(
            List.of(List.of("ate", "eat", "tea"), List.of("bat"), List.of("nat", "tan"))), "example");
        check(norm(s.groupAnagrams(new String[]{""})).equals(List.of(List.of(""))), "empty word");
        check(norm(s.groupAnagrams(new String[]{"a"})).equals(List.of(List.of("a"))), "single");
        check(s.groupAnagrams(new String[]{}).isEmpty(), "no words");
        check(norm(s.groupAnagrams(new String[]{"ab", "aab", "ba"})).equals(
            List.of(List.of("aab"), List.of("ab", "ba"))), "counts matter");
    }
}
