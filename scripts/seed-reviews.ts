import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { sql } from "drizzle-orm";
import { getDatabase } from "../src/server/db";

const rawReviews = [
  {
    name: "Caca Amel",
    review: "lucuuu banget bajunya 😭 kirain bakal kegedean ternyata pas dong",
  },
  {
    name: "Nayla Putri",
    review:
      "baru pertama beli di sini, ternyata oke juga. bahannya masih bagus",
  },
  {
    name: "Cici Maharani",
    review: "AAA GEMES BANGETT, warnanya lebih cakep pas diliat langsung",
  },
  {
    name: "Dinda Aulia",
    review:
      "jujur agak takut beli thrift online, tapi pas dateng ternyata bersih dan wangi",
  },
  {
    name: "Mochi Amelia",
    review:
      "ini mah murah bgt buat kualitas segini wkwk, bakal cek koleksi barunya lagi",
  },
  {
    name: "Salsa Nabilla",
    review:
      "dapet 3 cuma 100rb tuh worth it sih menurutku, apalagi modelnya lucu semua",
  },
  {
    name: "Kezia Cantika",
    review: "ukurannya sesuai detail, untung baca dulu sebelum checkout hehe",
  },
  {
    name: "Rara Ayuningtyas",
    review:
      "cardigannya cakepp, tinggal dipaduin sama rok udah jadi outfit ngampus",
  },
  {
    name: "Zahra Anindya",
    review:
      "ada sedikit bekas pemakaian tapi emang udah dijelasin di deskripsi. masih oke kok",
  },
  {
    name: "Nacaa Putrii",
    review: "SUMPAH INI LUCU BGT 😭 nyesel cuma ambil satu",
  },
  {
    name: "Fira Oktaviani",
    review: "packingnya rapi, bajunya juga ga bau apek. aman lah pokoknya",
  },
  {
    name: "Lala Gemoy",
    review: "awalnya iseng liat-liat malah checkout 3 biji wkwkw",
  },
  {
    name: "Aurel Maharani",
    review:
      "blousenya cantik, cuma bagian lengan agak longgar di aku. masih bisa dipake sih",
  },
  {
    name: "Mimi Anastasya",
    review: "kirain warnanya bakal beda jauh, eh ternyata mirip foto. sukakkk",
  },
  {
    name: "Nabila Syakira",
    review:
      "suka karena detail ukuran sama minusnya ditulis jelas, jadi ga nebak-nebak",
  },
  {
    name: "Cacaaw",
    review: "KAK INI BAJUNYA GEMES 😭😭 berasa nemu harta karun",
  },
  {
    name: "Intan Permata",
    review:
      "buat harga segini menurutku udah bagus banget. jahitannya juga masih aman",
  },
  {
    name: "Bella Safitri",
    review:
      "pengiriman agak lama ke tempatku tapi bajunya sesuai semua, jadi gapapa",
  },
  {
    name: "Shafa Azzahra",
    review:
      "aku suka model-modelnya, ga terlalu pasaran. semoga sering restock yaa",
  },
  {
    name: "Mput Salsabila",
    review:
      "niatnya cuma nemenin temen liat katalog, malah aku yg kalap belanja 😭",
  },
  {
    name: "Tiara Maharani",
    review: "crop topnya pas banget di badan aku, dipake jalan sore lucu sih",
  },
  {
    name: "Nunu Amelia",
    review:
      "ternyata bahannya adem, kukira bakal agak tebel. enak dipake harian",
  },
  {
    name: "Vina Anggraini",
    review: "minus kecilnya masih wajar buat barang second. overall aku suka",
  },
  {
    name: "Cimoy Putri",
    review: "GILA SIH DAPET YANG SELUCU INI 😭 best purchase bulan ini wkwk",
  },
  {
    name: "Alya Kirana",
    review: "udah dicuci sekali dan masih bagus, warnanya juga ga luntur",
  },
  {
    name: "Nessa Febriani",
    review:
      "yang aku suka fotonya ga neko-neko, pas barang dateng ya sesuai ekspektasi",
  },
  {
    name: "Pipit Maharani",
    review:
      "agak kebesaran dikit tapi malah lucu dijadiin oversized outfit hehe",
  },
  {
    name: "Wawa Anjani",
    review:
      "PLISSS KOLEKSI BARUNYA KAPAN 😭 kemarin telat dikit udah sold semua",
  },
  {
    name: "Keysha Ramadhani",
    review:
      "bahannya masih halus, ga nyangka ini thrift. suka banget sama motifnya",
  },
  {
    name: "Meymey Lucinta",
    review: "beli buat outfit nongki, eh malah dipinjem adek terus wkwkw",
  },
  {
    name: "Riska Aprilia",
    review:
      "adminnya bantu jelasin ukuran pas aku nanya. untung jadi ga salah pilih",
  },
  {
    name: "Chika Amanda",
    review:
      "modelnya cakep tapi warna aslinya sedikit lebih gelap dari foto. masih suka kok",
  },
  {
    name: "Nay Nay",
    review: "AKU MAU BORONG LAGI TAPI DOMPET MENANGIS 😭😭",
  },
  {
    name: "Fani Maharani",
    review:
      "udah kedua kalinya beli. kali ini ambil kemeja sama dua atasan, semuanya kepake",
  },
  {
    name: "Bubu Anindita",
    review: "lucuu, cuma harus disetrika dulu biar lebih rapi. sisanya aman",
  },
  {
    name: "Putri Cahyani",
    review:
      "suka konsep thriftnya, bisa dapet baju bagus tanpa harus keluar banyak duit. next mau cari dress",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

async function main() {
  const db = getDatabase();

  // 1. Fetch active products
  const productsResult = await db.execute<{
    id: string;
    name: string;
  }>(
    sql`select id, name from products where status = 'active' order by created_at desc`,
  );

  const products = productsResult.rows;
  if (!products.length) {
    throw new Error("Tidak ada produk aktif ditemukan di database.");
  }

  // 2. Fetch admin user for moderator
  const usersResult = await db.execute<{
    id: string;
    email: string;
  }>(sql`select id, email from users order by created_at asc limit 1`);

  const moderator = usersResult.rows[0];
  if (!moderator) {
    throw new Error("Tidak ada admin user untuk memoderasi ulasan.");
  }

  console.log(`Menemukan ${products.length} produk aktif.`);
  console.log(`Moderator: ${moderator.email} (${moderator.id})`);

  // 3. Shuffle reviews for random distribution
  const shuffledReviews = shuffle(rawReviews);

  // 4. Distribute reviews so every product gets at least 3 reviews
  // 36 reviews across products.
  const productCount = products.length;
  const assignments: {
    product: { id: string; name: string };
    review: (typeof rawReviews)[0];
  }[] = [];

  // Round-robin distribution ensures equal and random spread
  shuffledReviews.forEach((review, idx) => {
    const prod = products[idx % productCount]!;
    assignments.push({ product: prod, review });
  });

  const now = Date.now();

  console.log("\nMemasukkan ulasan ke database...");

  for (let i = 0; i < assignments.length; i++) {
    const item = assignments[i]!;
    const { product, review } = item;

    // Spread createdAt between 2 to 28 days ago with random jitter
    const daysAgo = 2 + Math.floor(Math.random() * 26);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const createdTime = new Date(
      now -
        (daysAgo * 86400 + hoursAgo * 3600 + minutesAgo * 60 + i * 137) * 1000,
    );
    // moderatedAt is 10-60 minutes after createdAt
    const moderatedTime = new Date(
      createdTime.getTime() + (10 + Math.floor(Math.random() * 50)) * 60 * 1000,
    );

    const reviewId = crypto.randomUUID();

    await db.execute(sql`
      insert into reviews (
        id,
        product_id,
        order_id,
        reviewer_name,
        rating,
        body,
        status,
        moderated_by,
        moderated_at,
        created_at,
        updated_at
      ) values (
        ${reviewId},
        ${product.id},
        null,
        ${review.name},
        5,
        ${review.review},
        'approved',
        ${moderator.id},
        ${moderatedTime},
        ${createdTime},
        ${moderatedTime}
      )
    `);

    console.log(
      `[OK] (${i + 1}/${assignments.length}) ${product.name} <- "${review.name}" (5★): "${review.review.slice(0, 40)}..."`,
    );
  }

  // Summary per product
  console.log("\n--- Ringkasan Review per Produk ---");
  const summaryResult = await db.execute<{
    name: string;
    review_count: number;
    avg_rating: string;
  }>(sql`
    select 
      p.name, 
      count(r.id)::int as review_count, 
      round(avg(r.rating)::numeric, 1) as avg_rating
    from products p
    left join reviews r on r.product_id = p.id and r.status = 'approved'
    group by p.id, p.name
    order by p.name asc
  `);

  console.table(summaryResult.rows);
}

try {
  await main();
} catch (err) {
  console.error("Gagal melakukan seeding ulasan:", err);
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) {
    await getDatabase().$client.end();
  }
}
