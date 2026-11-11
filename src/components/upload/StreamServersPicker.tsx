import { Captions, Mic, CheckCircle2 } from 'lucide-react';
import { SERVER_CONFIGS, DUB_SERVERS, SUB_SERVERS } from '@/hooks/useServerAutoSelect';

export type StreamKind = 'dub' | 'sub';

const names = (ids: typeof DUB_SERVERS) => ids.map(id => SERVER_CONFIGS[id].name).join(' · ');

const OPTIONS: { value: StreamKind; title: string; Icon: typeof Mic; detail: string }[] = [
  { value: 'dub', title: 'DUB', Icon: Mic, detail: `DUB servers ${names(DUB_SERVERS)}, plus SUB ${names(SUB_SERVERS)} on episodes with a SUB video` },
  { value: 'sub', title: 'SUB', Icon: Captions, detail: `Only the ${names(SUB_SERVERS)} server, Japanese audio` },
];

/** Upload choice of which player servers a title gets. SUB stores the existing SUB-only flag. */
export function StreamServersPicker({ value, onChange, disabled }: {
  value: StreamKind; onChange: (value: StreamKind) => void; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Streaming servers" className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map(({ value: v, title, Icon, detail }) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors disabled:opacity-60 ${
              selected ? 'border-primary/40 bg-primary/10' : 'border-border/40 bg-muted/20 hover:border-primary/30'
            }`}
          >
            <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-[11px] text-muted-foreground">{detail}</span>
            </span>
            {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
