export async function onRequestGet() {
  const body = "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: https://mathslearn.online/sitemap.xml\n";
  return new Response(body, {status:200,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
}
