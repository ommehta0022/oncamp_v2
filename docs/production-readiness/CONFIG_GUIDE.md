# Configuration Guide

This document defines the required and optional environment variables for deploying oncamp_v2.

## Backend (FastAPI / Railway)

| Variable | Required | Description | Example / Default |
|----------|----------|-------------|-------------------|
| DEV_MODE | No | Enables debug features | 	rue |
| SUPABASE_URL | Yes | Supabase REST URL | https://xxxx.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Admin API key | eyJhb... |
| TWILIO_ACCOUNT_SID | Yes | Twilio SID | AC... |
| TWILIO_AUTH_TOKEN | Yes | Twilio Token | ... |
| TWILIO_PHONE_NUMBER | Yes | Twilio Sender Number | +1234567890 |
| FIREBASE_SERVICE_ACCOUNT_JSON | Yes | Firebase Admin JSON | {...} |

## Admin Panel (Next.js / Vercel)

| Variable | Required | Description | Example / Default |
|----------|----------|-------------|-------------------|
| NEXT_PUBLIC_API_URL | Yes | Backend API URL | https://api.example.com |
