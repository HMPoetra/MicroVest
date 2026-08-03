async function test() {
  try {
    const htmlRes = await fetch("https://emasantam.id/harga-emas-antam-harian/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const match = html.match(/var chart_data\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        const rawData = JSON.parse(match[1]);
        console.log("Last 5 items in chart_data:", rawData.slice(-5));
      } else {
        console.log("No chart_data found in html");
      }
    } else {
      console.log("Failed to fetch html:", htmlRes.status);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
