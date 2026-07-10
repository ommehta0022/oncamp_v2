# Incident Runbook: Service Outage

## 1. Triage
- Check Railway metrics for CPU/Memory spikes.
- Check Supabase dashboard for DB load and connection count.
- Check Vercel logs for frontend API errors.

## 2. Immediate Mitigation
- If Railway backend is OOM crashing, restart the service or upgrade the RAM in Railway settings.
- If Supabase connections are maxed out, verify the backend isn't leaking connections. Check if a redeploy of the backend fixes the leak.
- If Twilio is failing (e.g., OTP delivery issues), check the Twilio status page. The backend returns HTTP 400 when Twilio fails.

## 3. Communication
- Notify stakeholders on Slack/Discord.
- Update the public status page if applicable.

## 4. Post-Mortem
- Save the Railway logs to a file.
- Document the root cause and add preventative measures.
