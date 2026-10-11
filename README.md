# ShareBite

A food donation and redistribution platform. Donors (canteens, caterers, bakeries) list surplus food; verified NGOs request it and collect it before the deadline.

**Stack:** HTML, CSS, JavaScript (no framework), Node.js, Express.js, MongoDB, Mongoose.

## Features

- Registration and login with roles: donor, recipient (NGO), admin. Passwords hashed with bcrypt, sessions via JWT.
- Donors: add, edit and remove listings with quantity, details, collection deadline and a photo.
- Search and filter by keyword, food type, location, minimum quantity and status. Available and reserved listings are both visible.
- Requests: verified NGOs request a quantity; donors accept (and set a pickup time) or reject.
- Pickup tracking: scheduled, collected, no-show (quantity is released back to the listing), cancelled.
- Feedback: recipients rate a donation after collection.
- Impact dashboard: donations, completed pickups, portions redistributed, top donors, personal contribution.
- Admin: verify NGO accounts and remove any listing.

## Food-safety rules (`utils/safety.js`)

- Only five categories are allowed, each with a maximum listing window: cooked meals 6 h, packaged dairy 12 h, bakery 24 h, fresh produce 48 h, sealed packaged food 7 days.
- Listings containing blocked terms (raw meat or fish, alcohol, half-eaten food, spoiled or mouldy food) are rejected.
- Donors must confirm the food is fresh, safely stored and fit to eat.
- Expired listings are marked `expired` automatically (every minute and on every search), never shown as available, and their open requests are cancelled.
- NGOs must be verified by an admin before they can request food.

## Run locally

Requires Node.js 18+ and MongoDB (local or Atlas).

```bash
git clone https://github.com/<your-username>/sharebite.git
cd sharebite
npm install
cp .env.example .env      # set MONGO_URI and JWT_SECRET
npm run seed              # optional demo data
npm start                 # http://localhost:3000
```

To open the app from another device on the same Wi-Fi, run the server on this
computer and visit `http://<this-computer's-LAN-IP>:3000` on the other device.
Allow Node.js through the computer's firewall on private networks if prompted.
The server uses MongoDB, so `MONGO_URI` must point to a database reachable from
this computer. This LAN setup does not make the app available over the public
internet; for that, deploy the app and database to hosting services.

Demo accounts after seeding (password `Password@123`):

| Email | Role |
|---|---|
| admin@sharebite.test | admin |
| canteen@sharebite.test | donor |
| bakery@sharebite.test | donor |
| hope@sharebite.test | verified NGO |
| pending@sharebite.test | NGO awaiting verification |

## MongoDB collections

| Collection | Fields |
|---|---|
| users | name, email, passwordHash, role, organization, phone, address, verified |
| donations | donor, foodName, description, quantity, reservedQty, unit, category, pickupLocation, collectionDeadline, imageUrl, safetyConfirmed, status |
| requests | donation, requester, quantity, message, status |
| pickups | request, donation, pickupTime, status, completedAt |
| feedback | donation, user, rating, comments |

## API overview

| Method and path | Who | Purpose |
|---|---|---|
| POST /api/auth/register, /login; GET /me | public / any | Accounts |
| GET /api/donations | public | Search (`search, category, location, minQty, status`) |
| GET /api/donations/mine | donor | My listings |
| POST, PUT, DELETE /api/donations(/:id) | donor | Manage listings (multipart for image) |
| POST /api/requests | verified NGO | Request food |
| GET /api/requests/mine, /incoming | NGO / donor | Lists |
| PATCH /api/requests/:id/accept, reject, complete, no-show | donor | Handle requests and pickups |
| PATCH /api/requests/:id/cancel | NGO | Cancel |
| POST /api/feedback | NGO | Rate a completed pickup |
| GET /api/stats, /api/stats/me | public / user | Impact numbers |
| GET, PATCH, DELETE /api/admin/... | admin | Verify NGOs, remove listings |

## Project structure

```
server.js            Express app and MongoDB connection
models/              Mongoose schemas
routes/              API routes
middleware/auth.js   JWT auth and role checks
utils/               safety rules and expiry logic
public/              HTML, CSS, JavaScript front end
seed.js              demo data
```

## Suggested split for a group of five

1. Auth and users (`routes/auth.js`, `middleware/auth.js`, login and register views)
2. Donor listings and image upload (`routes/donations.js`, post and dashboard views)
3. Search and filters (`GET /api/donations`, browse view)
4. Requests and pickups (`routes/requests.js`, request dialogs)
5. Impact and admin (`routes/stats.js`, `routes/admin.js`, impact and admin views)

## Push to GitHub

```bash
git init
git add .
git commit -m "ShareBite: food donation and redistribution platform"
git branch -M main
git remote add origin https://github.com/<your-username>/sharebite.git
git push -u origin main
```

## Possible improvements

Email or SMS notifications, map view of pickup locations, automated tests, image resizing, deployment to Render with MongoDB Atlas.
