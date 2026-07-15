"""Yahtzee scoring rules: category definitions, entry validation, and totals.

This app uses *final-score entry* — players type/tap the value they scored, not
the individual dice. So the engine's job is to:

  1. validate that an entered value is *legal* for its category, and
  2. compute all subtotals, bonuses, and the grand total.

When virtual dice are added later, a dice-scoring function can compute the value
and feed it through this same validation + totaling path unchanged.

A value of 0 always means the category was *scratched* (a deliberate zero), which
is distinct from "not yet filled" (no row stored at all).
"""

from __future__ import annotations

from enum import Enum


class Category(str, Enum):
    ONES = "ones"
    TWOS = "twos"
    THREES = "threes"
    FOURS = "fours"
    FIVES = "fives"
    SIXES = "sixes"
    THREE_OF_A_KIND = "three_of_a_kind"
    FOUR_OF_A_KIND = "four_of_a_kind"
    FULL_HOUSE = "full_house"
    SMALL_STRAIGHT = "small_straight"
    LARGE_STRAIGHT = "large_straight"
    YAHTZEE = "yahtzee"
    CHANCE = "chance"


UPPER = [
    Category.ONES, Category.TWOS, Category.THREES,
    Category.FOURS, Category.FIVES, Category.SIXES,
]
LOWER = [
    Category.THREE_OF_A_KIND, Category.FOUR_OF_A_KIND, Category.FULL_HOUSE,
    Category.SMALL_STRAIGHT, Category.LARGE_STRAIGHT, Category.YAHTZEE,
    Category.CHANCE,
]
ALL_CATEGORIES = UPPER + LOWER

# Face value each upper-section category counts.
UPPER_FACE = {
    Category.ONES: 1, Category.TWOS: 2, Category.THREES: 3,
    Category.FOURS: 4, Category.FIVES: 5, Category.SIXES: 6,
}

# Fixed-value categories: the only legal non-zero value is the fixed score.
FIXED_VALUES = {
    Category.FULL_HOUSE: 25,
    Category.SMALL_STRAIGHT: 30,
    Category.LARGE_STRAIGHT: 40,
    Category.YAHTZEE: 50,
}

# Free-value (sum-of-dice) categories.
SUM_CATEGORIES = {Category.THREE_OF_A_KIND, Category.FOUR_OF_A_KIND, Category.CHANCE}

UPPER_BONUS_THRESHOLD = 63
UPPER_BONUS = 35
YAHTZEE_BONUS = 100

MIN_DICE_SUM = 5    # five dice, all ones
MAX_DICE_SUM = 30   # five dice, all sixes


class ScoreError(ValueError):
    """Raised when an entered value is not legal for its category."""


def validate(category: Category, value: int) -> None:
    """Raise ScoreError if ``value`` is not a legal entry for ``category``.

    0 is always legal — it represents scratching the category.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise ScoreError(f"{category.value}: value must be an integer")
    if value == 0:
        return  # scratch is always allowed
    if value < 0:
        raise ScoreError(f"{category.value}: value cannot be negative")

    if category in UPPER_FACE:
        face = UPPER_FACE[category]
        if value % face != 0 or value > face * 5:
            raise ScoreError(
                f"{category.value}: must be 0 to 5 of a {face} "
                f"(a multiple of {face} up to {face * 5}), got {value}"
            )
    elif category in FIXED_VALUES:
        fixed = FIXED_VALUES[category]
        if value != fixed:
            raise ScoreError(f"{category.value}: must be 0 or {fixed}, got {value}")
    elif category in SUM_CATEGORIES:
        if not (MIN_DICE_SUM <= value <= MAX_DICE_SUM):
            raise ScoreError(
                f"{category.value}: must be 0 or {MIN_DICE_SUM}-{MAX_DICE_SUM}, "
                f"got {value}"
            )
    else:  # pragma: no cover - every category is covered above
        raise ScoreError(f"unknown category: {category}")


def validate_yahtzee_bonus(bonus_count: int, yahtzee_value: int | None) -> None:
    """Validate a Yahtzee bonus claim (+100 each).

    A bonus is only legal if the Yahtzee box already holds 50. If Yahtzee was
    scratched (0) or is still unfilled (None), no bonus may be claimed — that
    forfeit is part of the official rules.
    """
    if isinstance(bonus_count, bool) or not isinstance(bonus_count, int):
        raise ScoreError("yahtzee bonus count must be an integer")
    if bonus_count < 0:
        raise ScoreError("yahtzee bonus count cannot be negative")
    if bonus_count > 0 and yahtzee_value != FIXED_VALUES[Category.YAHTZEE]:
        raise ScoreError("yahtzee bonus requires the Yahtzee box to be scored 50")


def compute_totals(scores: dict[str, int], bonus_count: int = 0) -> dict:
    """Compute subtotals, bonuses, and the grand total.

    ``scores`` maps category value -> score and may be partial (unfilled
    categories omitted). Returns a breakdown dict for the client.
    """
    def val(cat: Category) -> int:
        return int(scores.get(cat.value, 0) or 0)

    upper_subtotal = sum(val(c) for c in UPPER)
    upper_bonus = UPPER_BONUS if upper_subtotal >= UPPER_BONUS_THRESHOLD else 0
    upper_total = upper_subtotal + upper_bonus

    lower_subtotal = sum(val(c) for c in LOWER)
    yahtzee_bonus_total = bonus_count * YAHTZEE_BONUS

    grand_total = upper_total + lower_subtotal + yahtzee_bonus_total

    return {
        "upper_subtotal": upper_subtotal,
        "upper_bonus": upper_bonus,
        "upper_total": upper_total,
        "lower_subtotal": lower_subtotal,
        "yahtzee_bonus_count": bonus_count,
        "yahtzee_bonus_total": yahtzee_bonus_total,
        "grand_total": grand_total,
    }
