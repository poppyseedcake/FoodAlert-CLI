# FoodAlert

FoodAlert tracks Foodsi offers for multiple local users and reports changes in current offer availability.

## Language

**Offer Snapshot**:
One user's current fetched view of provider offers during a watcher run. Recording an Offer Snapshot updates restaurant, offer, and user offer state records, then identifies previously seen offers that disappeared from the current fetch.
_Avoid_: Offer intake, fetched offer batch

**Alert Derivation**:
The rules that turn an Offer Snapshot change set and a user's restaurant notification policy into Alert Events. Alert Derivation owns new offer, re-stocked, stock-change, sold-out, favorite-only, and ignored-restaurant decisions.
_Avoid_: Offer diffing, watcher alert rules
