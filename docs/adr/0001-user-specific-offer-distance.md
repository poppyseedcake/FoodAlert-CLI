# User-specific offer distance

Foodsi returns offer distance from the signed-in user's configured location, so the same provider offer can have different distances for different users. Store distance as part of User Offer State rather than the shared provider offer record, and order user-specific offer views by that per-user distance with unknown distances last.
