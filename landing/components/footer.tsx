import { Logo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { appUrl } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="bg-[#071f1d] text-[#d5e4e0]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#b7ccc8]">
            Stomatologiya klinikasi uchun bemor, implant, navbat va to&apos;lov tizimi. Bemorlar uchun sayt emas.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Sahifalar</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="/stomatolog-crm">Stomatolog CRM</a></li>
            <li><a className="hover:text-white" href="/tariflar">Tariflar</a></li>
            <li><a className="hover:text-white" href="/#savollar">Savollar</a></li>
            <li><a className="hover:text-white" href={appUrl()}>Klinikaga kirish</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Aloqa va hujjatlar</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="mailto:hello@shifo.uz">hello@shifo.uz</a></li>
            <li><a className="hover:text-white" href="https://t.me/shifocrm">Telegram @shifocrm</a></li>
            <li><a className="hover:text-white" href="/maxfiylik">Maxfiylik siyosati</a></li>
            <li><a className="hover:text-white" href="/shartlar">Ommaviy oferta</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <Separator className="bg-white/10" />
        <p className="py-5 text-xs text-[#8eada8]">© {new Date().getFullYear()} SHIFO CRM. Barcha huquqlar himoyalangan.</p>
      </div>
    </footer>
  );
}
