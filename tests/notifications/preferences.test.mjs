import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFS,
  isNotificationCategoryEnabled,
  preferenceCategoryForNotification,
} from "../../lib/notifications/preferences.ts";

describe("notification preference categories", () => {
  it("maps every notification kind to the intended setting", () => {
    assert.equal(preferenceCategoryForNotification("challenge"), "challenge");
    assert.equal(preferenceCategoryForNotification("challenge_completed"), "challenge");
    assert.equal(preferenceCategoryForNotification("goal"), "squad");
    assert.equal(preferenceCategoryForNotification("recap"), "squad");
    assert.equal(preferenceCategoryForNotification("contest"), "contests");
    assert.equal(preferenceCategoryForNotification("revenge"), "practice");
    assert.equal(preferenceCategoryForNotification("nudge", "nudge:squad-without-you:2026-11-20"), "squad");
    assert.equal(preferenceCategoryForNotification("nudge", "nudge:streak-risk:2026-11-20"), "practice");
  });

  it("respects the selected category without changing the all-on default", () => {
    assert.equal(isNotificationCategoryEnabled(DEFAULT_PREFS, "challenge"), true);
    assert.equal(
      isNotificationCategoryEnabled({ ...DEFAULT_PREFS, challenge: false }, "challenge_completed"),
      false
    );
    assert.equal(
      isNotificationCategoryEnabled({ ...DEFAULT_PREFS, squad: false }, "nudge", "nudge:squad-without-you:today"),
      false
    );
    assert.equal(
      isNotificationCategoryEnabled({ ...DEFAULT_PREFS, practice: false }, "nudge", "nudge:streak-risk:today"),
      false
    );
  });
});
