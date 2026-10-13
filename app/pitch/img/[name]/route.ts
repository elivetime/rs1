import { PITCH_IMAGES } from '@/lib/pitch/images';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(PITCH_IMAGES).map((n) => ({ name: `${n}.jpg` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const b64 = PITCH_IMAGES[name.replace(/\.jpg$/, '')];
  if (!b64) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(b64, 'base64'), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
