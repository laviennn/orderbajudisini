export default function ProductLoading() {
  return (
    <main
      id="main-content"
      className="page-width section-space"
      aria-busy="true"
      aria-label="Memuat produk"
    >
      <p role="status">Memuat detail produk…</p>
      <div className="product-detail">
        <div className="gallery-main skeleton" />
        <div>
          <div className="h-8 w-3/4 skeleton" />
          <div className="mt-6 h-6 w-1/3 skeleton" />
        </div>
      </div>
    </main>
  );
}
