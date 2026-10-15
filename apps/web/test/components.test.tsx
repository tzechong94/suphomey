import { scoreBlock, type BlockFacts } from '@suphomey/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Verdict } from '@/components/block/fair-price-check';
import { PreferenceChips } from '@/components/explore/filters';
import { MatchBar } from '@/components/match-bar';
import { DEFAULT_STATE, type SearchState } from '@/lib/client/preferences';

function Chips({ initial = DEFAULT_STATE }: { initial?: SearchState }) {
  const [state, setState] = useState(initial);
  return <PreferenceChips state={state} onChange={(patch) => setState((s) => ({ ...s, ...patch }))} />;
}

describe('PreferenceChips', () => {
  it('cycles a chip through nice to have, must have and back to off', async () => {
    const user = userEvent.setup();
    render(<Chips initial={{ ...DEFAULT_STATE, prefs: {} }} />);
    const park = () => screen.getByRole('button', { name: /^Park:/ });
    expect(park()).toHaveAccessibleName("Park: don't care. Tap to change.");
    await user.click(park());
    expect(park()).toHaveAccessibleName('Park: nice to have. Tap to change.');
    await user.click(park());
    expect(park()).toHaveAccessibleName('Park: must have (Park within 500 m). Tap to change.');
    await user.click(park());
    expect(park()).toHaveAccessibleName("Park: don't care. Tap to change.");
  });

  it('only offers the budget chip once a budget is set', () => {
    const { rerender } = render(<PreferenceChips state={DEFAULT_STATE} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Within budget/ })).toBeNull();
    rerender(<PreferenceChips state={{ ...DEFAULT_STATE, max: 3000 }} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /^Within budget/ })).toBeInTheDocument();
  });
});

describe('MatchBar', () => {
  const facts: BlockFacts = {
    leaseStartYear: 2000,
    nearestMrtM: 300,
    nearestHawkerM: 1500,
    nearestParkM: null,
    nearestClinicM: null,
    nearestPreschoolM: null,
    primarySchools1km: 0,
    busStops400m: 0,
    medianRent: {},
    medianPrice: {},
  };

  it('shows the percentage and explains every part to screen readers', () => {
    render(<MatchBar match={scoreBlock(facts, { mrt: 'nice', hawker: 'nice', park: 'must' })} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Nearest MRT exit: 300 m away')).toBeInTheDocument();
    expect(screen.getByText('Must have. Nearest park: no data')).toBeInTheDocument();
  });
});

describe('Verdict', () => {
  it('states the comparison in numbers, not just vibes', () => {
    render(
      <Verdict
        kind="rent"
        flatType="4-ROOM"
        amount={3600}
        result={{ verdict: 'atas', percentile: 95, vsMedian: 0.2, median: 3000, p25: 2900, p75: 3100, sample: { scope: 'street', count: 40, fromMonth: '2024-10-01', toMonth: '2026-09-01' } }}
      />,
    );
    expect(screen.getByText('Bit atas. Most people here paid less.')).toBeInTheDocument();
    expect(screen.getByText(/\$3,600\/mo is 20% above the median of \$3,000, higher than 95% of deals\./)).toBeInTheDocument();
    expect(screen.getByText(/Compared with 40 4-room rentals on this street, Oct 2024 to Sep 2026/)).toBeInTheDocument();
  });
});
