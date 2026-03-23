# SwiftRescue

Emergency ambulance platform with:
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

## Deployment

## 1) Frontend (Vercel)

1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and import this repo.
3. Keep defaults:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy.

`vercel.json` is already added for SPA routing.

## 2) Backend (Render/Railway)

Use the `/Backend` folder as the service root.

Start command:
```bash
gunicorn ambulance.wsgi
```

Make sure these env vars are configured on your backend host:
- `DEBUG=False`
- `ALLOWED_HOSTS=<your-backend-domain>`
- CORS settings for your frontend domain

## Git Remote

Configured remote:
`https://github.com/vashupanchalcs-ops/Ambulanceemergency.git`
