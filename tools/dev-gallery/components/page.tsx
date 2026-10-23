// NOTE — archived gallery (moved out of src/app 2026-10-22, W3).
// This file is UNROUTED and EXCLUDED from the production build. It is
// preserved verbatim from src/app/dev/components/page.tsx. It references
// the old v2 fixture seam and will not compile in its current location.
// Do not move back under src/app without re-integrating the data seam.

'use client';

import { useState } from 'react';
import {
  Button,
  Badge,
  Field,
  Select,
  TextInput,
  Textarea,
  Checkbox,
  Radio,
  RadioGroup,
  Toggle,
  DateInput,
  SearchInput,
  NumberInput,
  FilterChip,
  Tabs,
  Progress,
  Avatar,
  Icon,
  Card,
  Surface,
  Divider,
  Stack,
  Inline,
  Metric,
  EmptyState,
} from '@/components/df/primitives';
import { DealCard } from '@/components/df/deal-card';
import { NextStep } from '@/components/df/next-step';
import { sample } from '@/lib/df/types';

const deal = sample.deals[0];
const person = sample.people[0];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Surface as="section" pad="lg" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </Surface>
  );
}

export default function ComponentsPage() {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('a');
  const [toggle, setToggle] = useState(false);
  const [tab, setTab] = useState('one');
  const [chips, setChips] = useState<string[]>(['Won']);

  return (
    <div className="min-h-screen bg-canvas p-6">
      <Stack gap="lg" className="mx-auto max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold text-ink">DF component gallery</h1>
          <p className="text-sm text-ink-2">Every df primitive on one page, wired to local state.</p>
        </header>

        <Section title="Buttons">
          <Inline gap="sm" wrap>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </Inline>
        </Section>

        <Section title="Badges">
          <Inline gap="sm" wrap>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="success">Won</Badge>
            <Badge tone="warning">At risk</Badge>
            <Badge tone="danger">Lost</Badge>
          </Inline>
        </Section>

        <Section title="Fields">
          <Stack gap="md" className="max-w-md">
            <Field label="Name" hint="Your full name">
              <TextInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ada Lovelace" />
            </Field>
            <Field label="Stage" error="Pick a stage">
              <Select
                options={[{ value: 'a', label: 'Discovery' }, { value: 'b', label: 'Proposal' }]}
                value="a"
                onChange={() => {}}
              />
            </Field>
            <Field label="Notes">
              <Textarea rows={3} placeholder="Context for the next call…" />
            </Field>
            <Inline gap="md">
              <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} label="Subscribe" />
              <Toggle checked={toggle} onChange={setToggle} label="Reminders" />
            </Inline>
            <RadioGroup value={radio} onChange={setRadio} label="Cadence">
              <Radio value="a" label="Weekly" />
              <Radio value="b" label="Monthly" />
            </RadioGroup>
            <Inline gap="md">
              <Field label="Close date">
                <DateInput value="2026-11-01" onChange={() => {}} />
              </Field>
              <Field label="Amount">
                <NumberInput value={50000} onChange={() => {}} />
              </Field>
            </Inline>
            <Field label="Search">
              <SearchInput value={input} onChange={setInput} placeholder="Search deals…" />
            </Field>
          </Stack>
        </Section>

        <Section title="Filter chips & tabs">
          <Inline gap="sm" wrap>
            {['Won', 'Open', 'Lost'].map((c) => (
              <FilterChip
                key={c}
                label={c}
                active={chips.includes(c)}
                onToggle={() =>
                  setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
                }
              />
            ))}
          </Inline>
          <Tabs
            tabs={[{ id: 'one', label: 'Pipeline' }, { id: 'two', label: 'Activities' }]}
            active={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="Feedback">
          <Stack gap="md" className="max-w-md">
            <Progress value={62} />
            <Inline gap="sm">
              <Avatar name={person.name} bg={person.avatarBg} color={person.avatarColor} />
              <Avatar name="Acme Corp" />
            </Inline>
            <Inline gap="sm">
              <Icon name="check" /> <Icon name="alert" /> <Icon name="clock" />
            </Inline>
            <Metric label="Pipeline value" value="$1.2M" delta="+8%" />
          </Stack>
        </Section>

        <Section title="Deal card & next step">
          <div className="grid gap-4 md:grid-cols-2">
            <DealCard deal={deal} />
            <NextStep deal={deal} />
          </div>
        </Section>

        <Section title="Layout">
          <Card pad="md">
            <Stack gap="sm">
              <p className="text-sm text-ink">Card inside a stack, above a divider.</p>
              <Divider />
              <p className="text-sm text-ink-2">Secondary copy under the divider.</p>
            </Stack>
          </Card>
          <EmptyState
            title="No deals yet"
            body="Create your first deal to populate the pipeline."
            action={<Button variant="primary">New deal</Button>}
          />
        </Section>
      </Stack>
    </div>
  );
}
