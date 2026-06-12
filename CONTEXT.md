# FoodAlert - CLI

FoodAlert - CLI tracks Foodsi offers for multiple local users and reports changes in current offer availability.

## Language

**User Profile**:
A single Foodsi account tracked by the CLI, identified by its Foodsi email and password. Each User Profile owns its own Alert Policy, Alert Delivery preferences, and restaurant lists.
_Avoid_: Account, profile, user

**Offer Snapshot**:
One user's current fetched view of provider offers during a watcher run. Recording an Offer Snapshot updates restaurant, offer, and user offer state records, then identifies previously seen offers that disappeared from the current fetch.
_Avoid_: Offer intake, fetched offer batch

**User Offer State**:
The user-specific facts remembered for a provider offer from that user's latest Offer Snapshot. User Offer State owns per-user availability and proximity values that can differ between users for the same provider offer. When user-specific offer views are ordered by proximity, known distances come before unknown distances.
_Avoid_: Global offer state, shared offer distance

**Alert Policy**:
The per-user rules determining which Alert Event categories are relevant, shared by every Alert Delivery channel. New-offer events are always relevant, while re-stocked, stock-change, and sold-out events can each be enabled independently.
_Avoid_: Per-channel alert filters, notification type settings

**Alert Derivation**:
The rules that turn an Offer Snapshot change set and a user's Alert Policy into Alert Events. Alert Derivation owns new offer, re-stocked, stock-change, sold-out, favorite-only, and ignored-restaurant decisions.
_Avoid_: Offer diffing, watcher alert rules

**Alert Delivery**:
The per-user routing of Alert Events to output channels such as the console or Telegram. Alert Delivery decides where already-derived alerts are sent.
_Avoid_: Alert derivation, transport plumbing

**Telegram Connection**:
A User Profile's linked Telegram chat for receiving Alert Events. A Telegram Connection is established when a Telegram chat proves ownership of a pairing code generated for that User Profile.
_Avoid_: Telegram account, Telegram user

**Database Session**:
The runtime database lifecycle for one active SQLite database. A Database Session owns path selection, connection pragmas, migration, default settings seed, the active Drizzle database handle, and teardown.
_Avoid_: Database client import side effect, test DB env reset

**Provider Identity**:
The stable provider-scoped identity for an external restaurant or offer. Provider Identity owns equality keys, display labels, and grouping by provider plus external id.
_Avoid_: Ad hoc `provider:externalId` strings

**CLI Workflows**:
User-facing command flows behind the prompt adapter. CLI Workflows own profile deletion cleanup and restaurant list mutations for favorites and ignored restaurants.
_Avoid_: Prompt loop business rules
