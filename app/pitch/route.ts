import { PITCH_BODY } from '@/lib/pitch/body';
import { config } from '@/lib/config';

export const dynamic = 'force-static';

export function GET() {
  const isFile = /\.(mp4|webm|m4v)(\?|$)/i.test(config.videoUrl);
  const cfg = { imgBase: '/pitch/img/', bookUrl: '/', sameSite: true, videoUrl: config.videoUrl, videoEmbed: !isFile };
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow">' +
    `<script>window.PITCH_CONFIG=${JSON.stringify(cfg).replace(/</g, '\\u003c')};</script>` +
    '</head><body>' + PITCH_BODY + '</body></html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
