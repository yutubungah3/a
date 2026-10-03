const DEFAULT_PUB_ID = "2PACX-1vSod7Mdzh3NW4a8uyA1cXEF51Clo-8I1KapKosN5-XgOyqXMWYoQ31_vdM53RhGJn_s6m8ETxNeTjqi";

export default async (request) => {
  try {
    const reqUrl = new URL(request.url);
    const pubId = process.env.SHEET_PUB_ID || DEFAULT_PUB_ID;
    const defaultGid = process.env.SHEET_GID || "";
    const gid = reqUrl.searchParams.get("gid") || defaultGid;

    const params = new URLSearchParams({ output: "csv", _: String(Date.now()) });
    if (gid) {
      params.set("gid", gid);
      params.set("single", "true");
    }

    const googleUrl = `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?${params.toString()}`;
    const response = await fetch(googleUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; DailyBreakdownDashboard/1.0)" }
    });

    if (!response.ok) {
      return new Response(`Google Sheets gagal merespons (${response.status}). Pastikan spreadsheet masih Publish to web.`, { status: 502 });
    }

    const csv = await response.text();
    if (!csv.trim()) return new Response("Google Sheets mengembalikan data kosong.", { status: 502 });

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    return new Response(`Terjadi error saat mengambil Google Sheet: ${error.message}`, { status: 500 });
  }
};
