import { Logo } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { appLabel, appUrl } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mute">
            Klinika jarayonlarini bitta tizimda boshqarish uchun stomatologiya CRM. Bemorlar uchun sayt emas.
          </p>
        </div>
        <div>
          <p className="font-semibold">Sahifalar</p>
          <ul className="mt-3 space-y-2 text-sm text-mute">
            <li><a className="hover:text-white" href="/#imkoniyatlar">Imkoniyatlar</a></li>
            <li><a className="hover:text-white" href="/#modullar">Modullar</a></li>
            <li><a className="hover:text-white" href="/tariflar">Tariflar</a></li>
            <li><a className="hover:text-white" href="/#savollar">FAQ</a></li>
            <li><a className="hover:text-white" href={appUrl()}>{appLabel()}</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Aloqa va hujjatlar</p>
          <ul className="mt-3 space-y-2 text-sm text-mute">
            <li><a className="hover:text-white" href="/#aloqa">Aloqa</a></li>
            <li><a className="hover:text-white" href="mailto:hello@shifo.uz">hello@shifo.uz</a></li>
            <li><a className="hover:text-white" href="/maxfiylik">Maxfiylik siyosati</a></li>
            <li><a className="hover:text-white" href="/shartlar">Ommaviy oferta</a></li>
            <li><a className="hover:text-white" href="/kirish">Kirish</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4">
        <Separator className="bg-white/10" />
        <p className="py-5 text-xs text-mute">© {new Date().getFullYear()} SHIFO CRM. Barcha huquqlar himoyalangan.</p>
      </div>
    </footer>
  );
}
