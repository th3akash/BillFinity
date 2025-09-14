# BillFinity

## Environment Variables

### Frontend
- `VITE_API_BASE_URL`: Base URL for the backend API. This value is injected at build
  time and exposed to the client via `window.BILLFINITY_API`.

When deploying on Vercel, configure this variable in the project settings so the
build process receives the correct API endpoint.
