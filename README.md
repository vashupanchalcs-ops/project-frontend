# SwiftRescue

Emergency ambulance platform:
- React + Vite frontend (`/src`)
- Django backend (`/Backend`)

## Local Run

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd Backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Production Deployment

## 1) Backend (Render or Railway)

Deploy the `Backend` app first and get a live backend URL.

- Root directory: `Backend`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn ambulance_tracker.wsgi:application`

Set environment variables:
- `DJANGO_SECRET_KEY=<strong-random-secret>`
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=<your-backend-domain>`
- `CORS_ALLOWED_ORIGINS=<your-frontend-domain>`
- `CSRF_TRUSTED_ORIGINS=<your-frontend-domain>`
- `EMAIL_HOST_USER=<smtp-email>`
- `EMAIL_HOST_PASSWORD=<smtp-app-password>`

Example for domains:
- `CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app`
- `CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app`

## 2) Frontend (Vercel)

Deploy frontend repo on Vercel:
- Build command: `npm run build`
- Output directory: `dist`
- Framework: `Vite`

Set Vercel environment variable:
- `VITE_API_BASE_URL=https://<your-backend-domain>`

Frontend already includes runtime URL mapping in `src/main.jsx`, so existing API calls automatically switch from local URL to your production backend.

## 3) How users access your site

- Users open your Vercel URL (or your custom domain).
- Frontend sends API calls to your backend URL from `VITE_API_BASE_URL`.
- You manage backend settings/logs/env vars in Render/Railway dashboard.

## Security note

If SMTP credentials were ever committed before, rotate them immediately in your email provider and keep only environment variables in production.
