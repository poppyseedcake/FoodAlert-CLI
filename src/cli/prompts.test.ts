import { describe, expect, it } from 'vitest';
import { alertPolicyFromCategories } from './prompts.js';

describe('Alert Policy prompts', () => {
  it('allows every optional Alert Event category to be disabled', () => {
    expect(alertPolicyFromCategories([])).toEqual({
      notifyReStocked: false,
      notifyStockChange: false,
      notifySoldOut: false,
    });
  });
});
