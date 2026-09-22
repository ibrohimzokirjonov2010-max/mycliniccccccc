import { IconChart, IconClock, IconShield, IconSmile } from "@/components/icons";
import { benefits } from "@/lib/content";

const icons = {
  clock: <IconClock />,
  shield: <IconShield />,
  chart: <IconChart />,
  smile: <IconSmile />,
};

export function Benefits() {
  return (
    <section id="imkoniyatlar" className="scroll-mt-24 border-y border-line bg-[#f7f3ea]">
      <h2 className="sr-only">SHIFO CRM imkoniyatlari</h2>
      <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item) => (
          <li key={item.title} className="rise flex gap-3">
            {icons[item.icon]}
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-mute">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
