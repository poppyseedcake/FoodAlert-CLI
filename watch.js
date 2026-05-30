const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const FOODSI_AUTH_URL = 'https://api.foodsi.pl/api/v2/auth/sign_in';
const FOODSI_API_BASE = 'https://api.foodsi.pl/api/v3/user/offers';

const FOODSI_HEADERS = {
  'Content-type': 'application/json',
  'system-version': 'android_3.0.0',
  'user-agent': 'okhttp/3.12.0',
};

let foodsiInStock = [];

function parseFoodsiApi(items) {
  return items.map((restaurant) => {
    const pickupFrom = new Date(restaurant.attributes.pickup_from);
    pickupFrom.setHours(pickupFrom.getHours() + 2);
    const pickupTo = new Date(restaurant.attributes.pickup_to);
    pickupTo.setHours(pickupTo.getHours() + 2);

    return {
      ...restaurant,
      opened_at: pickupFrom.toLocaleString('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ''),
      closed_at: pickupTo.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  });
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+00:00`;
}

async function foodsi() {
  const authRes = await fetch(FOODSI_AUTH_URL, {
    method: 'POST',
    headers: FOODSI_HEADERS,
    body: JSON.stringify({ email: config.auth.email, password: config.auth.password }),
  });

  if (!authRes.ok) {
    console.error('Foodsi auth failed:', authRes.status);
    return;
  }

  const accessToken = authRes.headers.get('access-token');
  const client = authRes.headers.get('client');
  const uid = authRes.headers.get('uid');

  const authHeaders = {
    ...FOODSI_HEADERS,
    'Access-Token': accessToken,
    'Client': client,
    'Uid': uid,
  };

  const timestamp = getTimestamp();
  const params = new URLSearchParams({
    'filter[package_category_ids][not_eq]': '[13]',
    'filter[package_category_ids][eq]': '[9,1]',
    'filter[active][eq]': 'true',
    'filter[current_quantity][gt]': '0',
    'filter[pickup_to][gt]': timestamp,
    'page[size]': '15',
    'sort': 'distance,pickup_from',
  });

  let allItems = [];
  let url = `${FOODSI_API_BASE}?${params}`;

  while (url) {
    const res = await fetch(url, { headers: authHeaders });

    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText}`);
      return;
    }

    const json = await res.json();

    for (const item of json.data) {
      allItems.push(item);
    }

    url = (json.links && json.links.next && json.links.next !== json.links.self)
      ? json.links.next
      : null;
  }

  const items = parseFoodsiApi(allItems);
  console.log(`Foodsi total items: ${items.length}`);

  for (const item of items) {
    const oldEntry = foodsiInStock.find((s) => s.id === item.id);
    const oldStock = oldEntry ? oldEntry.attributes.current_quantity : 0;
    const newStock = item.attributes.current_quantity;

    if (newStock !== oldStock) {
      if (oldStock === 0 && newStock > 0) {
        console.log(`🆕 There are ${newStock} new goodie bags at ${item.attributes.venue_name} (${item.attributes.venue_logo})`);
        console.log(`   ${item.attributes.description}`);
        console.log(`   ${item.attributes.name}`);
        console.log(`   ${item.attributes.unit_price}PLN / ${item.attributes.original_price}PLN`);
        console.log(`   ${item.opened_at} - ${item.closed_at}`);
        console.log(`   foodsi.pl`);
      } else if (oldStock > newStock && newStock === 0) {
        console.log(`❌ Sold out! No more goodie bags at ${item.attributes.venue_name}.`);
      } else if (oldStock > newStock && newStock !== 0) {
        // skip
      } else {
        console.log(`ℹ️  Stock change from ${oldStock} to ${newStock} at ${item.attributes.venue_name}.`);
      }
    }
  }

  foodsiInStock = items;
  console.log(`Foodsi: API run at ${new Date().toLocaleString()} successful.`);
}

async function refresh() {
  try {
    await foodsi();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

console.log('Foodsi bot started. Checking every 1 minute.');
refresh();
setInterval(refresh, 60 * 1000);

