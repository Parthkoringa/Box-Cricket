import { allowedActions } from './permissions';

describe('allowedActions', () => {
  it('owner on a confirmed booking gets the full set', () => {
    const actions = allowedActions('owner', 'confirmed', true);
    expect(actions).toContain('edit');
    expect(actions).toContain('arrive');
    expect(actions).toContain('cancel');
    expect(actions).toContain('no_show');
    expect(actions).toContain('add_payment');
    expect(actions).toContain('delete_entries');
    expect(actions).not.toContain('complete');
  });

  it('worker on a confirmed actionable booking cannot edit or cancel', () => {
    const actions = allowedActions('worker', 'confirmed', true);
    expect(actions).toContain('arrive');
    expect(actions).toContain('no_show');
    expect(actions).not.toContain('edit');
    expect(actions).not.toContain('cancel');
    expect(actions).not.toContain('delete_entries');
  });

  it('arrived allows complete and payments', () => {
    const actions = allowedActions('worker', 'arrived', true);
    expect(actions).toEqual(expect.arrayContaining(['complete', 'add_payment', 'add_item']));
    expect(actions).not.toContain('arrive');
  });

  it('worker outside the actionable window gets nothing', () => {
    expect(allowedActions('worker', 'confirmed', false)).toEqual([]);
  });

  it('cancelled and no_show allow no payments; owner keeps only deletes', () => {
    expect(allowedActions('worker', 'cancelled', true)).toEqual([]);
    expect(allowedActions('owner', 'no_show', true)).toEqual(['delete_entries']);
  });

  it('completed still allows payment/item logging', () => {
    expect(allowedActions('owner', 'completed', true))
      .toEqual(expect.arrayContaining(['add_payment', 'add_item', 'delete_entries']));
  });
});
