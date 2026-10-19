// Vercel rejects request bodies over 4.5 MB before our code runs.
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 4);
