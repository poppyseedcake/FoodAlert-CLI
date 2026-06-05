# FoodAlert

FoodAlert tracks Foodsi offers for multiple local users and reports changes in current offer availability.

## Language

**Offer Snapshot**:
One user's current fetched view of provider offers during a watcher run. Recording an Offer Snapshot updates restaurant, offer, and user offer state records, then identifies previously seen offers that disappeared from the current fetch.
_Avoid_: Offer intake, fetched offer batch

**User Offer State**:
The user-specific facts remembered for a provider offer from that user's latest Offer Snapshot. User Offer State owns per-user availability and proximity values that can differ between users for the same provider offer. When user-specific offer views are ordered by proximity, known distances come before unknown distances.
_Avoid_: Global offer state, shared offer distance

**Alert Derivation**:
The rules that turn an Offer Snapshot change set and a user's restaurant notification policy into Alert Events. Alert Derivation owns new offer, re-stocked, stock-change, sold-out, favorite-only, and ignored-restaurant decisions.
_Avoid_: Offer diffing, watcher alert rules

**Database Session**:
The runtime database lifecycle for one active SQLite database. A Database Session owns path selection, connection pragmas, migration, default settings seed, the active Drizzle database handle, and teardown.
_Avoid_: Database client import side effect, test DB env reset

**Provider Identity**:
The stable provider-scoped identity for an external restaurant or offer. Provider Identity owns equality keys, display labels, and grouping by provider plus external id.
_Avoid_: Ad hoc `provider:externalId` strings

**CLI Workflows**:
User-facing command flows behind the prompt adapter. CLI Workflows own profile deletion cleanup and restaurant list mutations for favorites and ignored restaurants.
_Avoid_: Prompt loop business rules
