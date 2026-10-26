/** Monochrome partner wordmarks for the trust bar. No color logos allowed. */
const TRUST_BAR = [
  "PESO Koronadal",
  "City Government",
  "Barangay Hall Network",
  "TESDA Region XII",
  "7-Eleven CliQQ",
  "GCash",
];

export function TrustBar() {
  return (
    <section className="container-page pt-16">
      <div className="card relative isolate flex flex-col items-center gap-6 overflow-hidden px-6 py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-48 sm:w-64"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.88) 48%, rgba(255,255,255,.74) 100%), url('/images/service-sign.webp')",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%, cover",
            backgroundPosition: "center, right center",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <p className="caption text-center">
            Aligned with local government and national service networks
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {TRUST_BAR.map((name) => (
              <li
                key={name}
                className="text-[14px] leading-none font-medium tracking-[-0.02em] whitespace-nowrap text-stone-600"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
