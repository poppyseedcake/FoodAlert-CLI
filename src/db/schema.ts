import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  defaultWatchIntervalMinutes: integer('default_watch_interval_minutes').notNull().default(5),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  foodsiEmail: text('foodsi_email').notNull(),
  foodsiPassword: text('foodsi_password').notNull(),
  notifyOnlyFavorites: integer('notify_only_favorites', { mode: 'boolean' }).notNull().default(false),
  watchIntervalMinutes: integer('watch_interval_minutes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const restaurants = sqliteTable(
  'restaurants',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    address: text('address'),
    lastSeenAt: text('last_seen_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('restaurants_provider_external_id_idx').on(table.provider, table.externalId)],
);

export const offers = sqliteTable(
  'offers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id),
    name: text('name').notNull(),
    description: text('description'),
    currentQuantity: integer('current_quantity').notNull(),
    unitPrice: real('unit_price'),
    originalPrice: real('original_price'),
    pickupFrom: text('pickup_from'),
    pickupTo: text('pickup_to'),
    distanceKm: real('distance_km'),
    lastSeenAt: text('last_seen_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('offers_provider_external_id_idx').on(table.provider, table.externalId),
    index('offers_restaurant_id_idx').on(table.restaurantId),
  ],
);

export const userOfferStates = sqliteTable(
  'user_offer_states',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    offerId: integer('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }),
    currentQuantity: integer('current_quantity').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [uniqueIndex('user_offer_states_idx').on(table.userId, table.offerId)],
);

export const userFavoriteRestaurants = sqliteTable(
  'user_favorite_restaurants',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('user_favorite_restaurants_idx').on(table.userId, table.restaurantId)],
);

export const userIgnoredRestaurants = sqliteTable(
  'user_ignored_restaurants',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('user_ignored_restaurants_idx').on(table.userId, table.restaurantId)],
);
