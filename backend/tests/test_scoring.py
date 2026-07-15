"""Unit tests for the Yahtzee scoring/validation engine.

These are pure (no FastAPI, no DB) so they run fast and can be executed with a
bare ``python -m pytest`` — no app dependencies required beyond pytest itself.
"""

import pytest

from app.scoring import (
    Category,
    ScoreError,
    UPPER_BONUS,
    YAHTZEE_BONUS,
    compute_totals,
    validate,
    validate_yahtzee_bonus,
)


class TestUpperValidation:
    def test_valid_counts(self):
        validate(Category.FIVES, 0)    # scratch
        validate(Category.FIVES, 5)    # one five
        validate(Category.FIVES, 25)   # five fives
        validate(Category.ONES, 3)
        validate(Category.SIXES, 30)

    def test_non_multiple_rejected(self):
        with pytest.raises(ScoreError):
            validate(Category.FIVES, 7)      # not a multiple of 5

    def test_too_many_rejected(self):
        with pytest.raises(ScoreError):
            validate(Category.SIXES, 36)     # would be six sixes
        with pytest.raises(ScoreError):
            validate(Category.THREES, 18)    # would be six threes (max is 15)


class TestFixedValidation:
    def test_full_house(self):
        validate(Category.FULL_HOUSE, 0)
        validate(Category.FULL_HOUSE, 25)
        with pytest.raises(ScoreError):
            validate(Category.FULL_HOUSE, 20)

    def test_straights_and_yahtzee(self):
        validate(Category.SMALL_STRAIGHT, 30)
        validate(Category.LARGE_STRAIGHT, 40)
        validate(Category.YAHTZEE, 50)
        for bad in (25, 35, 45):
            with pytest.raises(ScoreError):
                validate(Category.LARGE_STRAIGHT, bad)


class TestSumValidation:
    def test_chance_range(self):
        validate(Category.CHANCE, 5)
        validate(Category.CHANCE, 30)
        validate(Category.CHANCE, 0)
        for bad in (4, 31, -1):
            with pytest.raises(ScoreError):
                validate(Category.CHANCE, bad)

    def test_kinds(self):
        validate(Category.THREE_OF_A_KIND, 17)
        validate(Category.FOUR_OF_A_KIND, 24)
        with pytest.raises(ScoreError):
            validate(Category.THREE_OF_A_KIND, 31)

    def test_booleans_rejected(self):
        # bool is a subclass of int in Python — make sure it's not accepted.
        with pytest.raises(ScoreError):
            validate(Category.CHANCE, True)


class TestYahtzeeBonus:
    def test_bonus_requires_fifty(self):
        validate_yahtzee_bonus(0, None)      # no bonus claimed -> fine
        validate_yahtzee_bonus(2, 50)        # legal
        with pytest.raises(ScoreError):
            validate_yahtzee_bonus(1, 0)     # yahtzee was scratched
        with pytest.raises(ScoreError):
            validate_yahtzee_bonus(1, None)  # yahtzee unfilled

    def test_negative(self):
        with pytest.raises(ScoreError):
            validate_yahtzee_bonus(-1, 50)


class TestTotals:
    def test_upper_bonus_applied_at_threshold(self):
        scores = {c.value: v for c, v in [
            (Category.ONES, 3), (Category.TWOS, 6), (Category.THREES, 9),
            (Category.FOURS, 12), (Category.FIVES, 15), (Category.SIXES, 18),
        ]}  # subtotal exactly 63 -> bonus applies
        t = compute_totals(scores)
        assert t["upper_subtotal"] == 63
        assert t["upper_bonus"] == UPPER_BONUS
        assert t["upper_total"] == 63 + 35

    def test_upper_bonus_not_applied_below_threshold(self):
        t = compute_totals({Category.ONES.value: 3})
        assert t["upper_bonus"] == 0

    def test_grand_total_with_yahtzee_bonuses(self):
        scores = {
            Category.SIXES.value: 30,
            Category.YAHTZEE.value: 50,
            Category.CHANCE.value: 20,
        }
        t = compute_totals(scores, bonus_count=2)
        # upper_subtotal=30 (<63, no bonus); lower = 50+20 = 70; yb = 200
        assert t["upper_total"] == 30
        assert t["lower_subtotal"] == 70
        assert t["yahtzee_bonus_total"] == 2 * YAHTZEE_BONUS
        assert t["grand_total"] == 30 + 70 + 200

    def test_empty_scores(self):
        assert compute_totals({})["grand_total"] == 0
