// Badge "Add to Apple Wallet" / "Aggiungi a Google Wallet".
//
// Riproduzioni fedeli alle linee guida dei rispettivi brand (badge nero,
// tipografia bianca, glifo wallet a sinistra): NON vanno ridisegnati in stile
// Klink. Gli hex qui sotto sono colori dei brand terzi (stessa eccezione del
// logo Google nel login). Per il pixel-perfect si possono sostituire con gli
// asset ufficiali scaricabili (Apple: developer.apple.com/wallet — Add to
// Apple Wallet guidelines; Google: developers.google.com/wallet — brand
// guidelines) mantenendo invariate le prop di questi componenti.

export function AppleWalletBadge({ height = 44 }: { height?: number }) {
  const width = Math.round((height / 44) * 148);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 148 44"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Add to Apple Wallet"
    >
      <rect width="148" height="44" rx="7" fill="#000000" />
      <rect x="0.5" y="0.5" width="147" height="43" rx="6.5" fill="none" stroke="#A6A6A6" />
      {/* Glifo Apple Wallet: carte impilate */}
      <g transform="translate(10 10)">
        <rect x="0" y="0" width="24" height="6.5" rx="2" fill="#FFB003" />
        <rect x="0" y="5" width="24" height="6.5" rx="2" fill="#40C740" />
        <rect x="0" y="10" width="24" height="6.5" rx="2" fill="#00A6E0" />
        <path
          d="M0 16.5 a2 2 0 0 1 2-2 h20 a2 2 0 0 1 2 2 v5 a2 2 0 0 1-2 2 h-20 a2 2 0 0 1-2-2 z"
          fill="#E33A2E"
        />
      </g>
      <text x="42" y="19" fill="#FFFFFF" fontSize="9" fontFamily="-apple-system, 'Helvetica Neue', Arial, sans-serif">
        Add to
      </text>
      <text x="42" y="33" fill="#FFFFFF" fontSize="13.5" fontWeight="600" fontFamily="-apple-system, 'Helvetica Neue', Arial, sans-serif">
        Apple Wallet
      </text>
    </svg>
  );
}

export function GoogleWalletBadge({ height = 44 }: { height?: number }) {
  const width = Math.round((height / 44) * 196);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 196 44"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Aggiungi a Google Wallet"
    >
      <rect width="196" height="44" rx="22" fill="#000000" />
      <rect x="0.5" y="0.5" width="195" height="43" rx="21.5" fill="none" stroke="#747775" />
      {/* Glifo Google Wallet: onde sovrapposte multicolore */}
      <g transform="translate(14 12)">
        <path d="M0 6 Q6 0 13 0 h11 a2 2 0 0 1 0 5 h-11 Q7 5 3 9 z" fill="#EA4335" />
        <path d="M0 11 Q7 4 14 5.5 h10 a2 2 0 0 1 0 5 h-10 Q8 10 3 14 z" fill="#FBBC04" />
        <path d="M0 16 Q8 9 15 11 h9 a2 2 0 0 1 0 5 h-9 Q9 15 4 19 z" fill="#4285F4" />
        <path d="M2 20 Q9 14 16 16.5 h8 a2 2 0 0 1-1 4.5 h-21 z" fill="#34A853" />
      </g>
      <text x="48" y="27" fill="#FFFFFF" fontSize="13" fontWeight="500" fontFamily="'Google Sans', Roboto, Arial, sans-serif">
        Aggiungi a Google Wallet
      </text>
    </svg>
  );
}
