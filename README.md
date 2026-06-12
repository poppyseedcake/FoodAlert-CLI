# FoodAlert - CLI

FoodAlert - CLI is a simple CLI for tracking Foodsi offers, (support multiple users). The application saves the latest offer status in a local SQLite database and issues alerts in CLI and/or via Telegram.

Get current offers:
![Get current offers](docs/assets/foodalert-run-once.gif)

Add restaurants to favorite:
![Favorite restaurants](docs/assets/foodalert-fav.gif)

## Motivation

Tired of constantly checking Foodsi to see if your favorite restaurant has added a new offer? Are others snapping up the best deals before you?
FoodAlert solves this problem. By receiving real-time information about new food boxes, you'll never be outdone again.

## Description

- Supports multiple Foodsi accounts in a single CLI
- Allows you to run a single fetch or a recurring offer check
- Saves current offers per user
- Reports changes to offer availability in the console or via Telegram
- Lets each user independently enable re-stocked, stock-change, and sold-out alerts
- Allows you to manage your list of favorite and ignored restaurants
- Allows you to enable notifications only for your favorite restaurants

## Quick Start

Requirements:

- Node.js 20+
- npm
- Telegram bot token in `FOODALERT_TELEGRAM_BOT_TOKEN` if you want Telegram alerts

Installation and start:

```bash
npm install
cp .env.example .env
# Set FOODALERT_TELEGRAM_BOT_TOKEN in .env
npm run dev
```

When you run the application for the first time, it will create a local `foodalert.sqlite` database in the project directory.

## Usage

Once launched, you'll see an interactive menu in the terminal.

1. Go to `Users` and add a Foodsi account.
2. Run `Run once for user` to retrieve the first offer status.
3. Go to `Offers` to view the current saved offers for the selected user.
4. Go to `Restaurants` to add restaurants to `favorites` or `ignored`.
5. Go to `Settings` if you want to configure Alert Policy, set a custom check interval, or enable `favorites only` mode.
6. Run `Watch one user` or `Watch all users` to have the application check offers periodically.
7. Use `Status` to view active watchers and `Stop watchers` to stop them.

Telegram alerts:

1. In `Settings`, generate a Telegram pairing code for a user.
2. Ask that user to open `@myfoodalert_bot` and send `/start <pairing-code>`.
3. Make sure the app is running so it can receive the Telegram update and store the chat link.

Alerts appear directly in the console. The app detects:

- new offer, which is always enabled
- offer back in stock, which is enabled by default for new users
- sold out, which is disabled by default for new users
- change in available items, which is disabled by default for new users

Alert Policy is shared by console and Telegram delivery. Existing users retain all alert categories when upgrading.

## Contributing

If you'd like to contribute, please fork the repository and open a pull request to the `main` branch.
